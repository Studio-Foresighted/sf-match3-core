import { Board, type TileData, TileType, type MatchResult } from './Board.ts';
import { BoardRenderer, TILE_SIZE } from '../render/BoardRenderer.ts';
import { FXManager } from '../fx/FXManager.ts';
import { HUD } from '../render/HUD.ts';
import { MoveFinder } from './MoveFinder.ts';
import { gsap } from 'gsap';

export class MatchResolver {
    private board: Board;
    private renderer: BoardRenderer;
    private fx: FXManager;
    private hud: HUD;
    private moveFinder: MoveFinder;
    private combo: number = 0;

    constructor(board: Board, renderer: BoardRenderer, fx: FXManager, hud: HUD) {
        this.board = board;
        this.renderer = renderer;
        this.fx = fx;
        this.hud = hud;
        this.moveFinder = new MoveFinder(board);
    }

    async resolve() {
        this.combo = 0;
        let hasMatches = true;
        while (hasMatches) {
            const matches = this.board.findMatches();
            if (matches.length === 0) {
                hasMatches = false;
                break;
            }

            if ((window as any).playAudioEvent) (window as any).playAudioEvent('match');

            this.combo++;
            if (this.combo === 4) {
                if ((window as any).playAudioEvent) (window as any).playAudioEvent('combo_4');
            }
            
            // 1. Handle Specials Creation
            this.handleSpecials(matches);

            // 2. Clear matches
            await this.clearMatches(matches);

            // 3. Gravity drop
            await this.applyGravity();

            // 4. Refill
            await this.refillBoard();
        }

        // SWEEP CHECK: Ensure no stuck matches
        const finalMatches = this.board.findMatches();
        if (finalMatches.length > 0) {
            console.log("Sweep detected stuck matches, resolving...");
            await this.resolve(); // Recursive call to clear them
        }
    }

    private handleSpecials(matches: MatchResult[]) {
        for (const match of matches) {
            if (match.specialToCreate !== null) {
                const tile = this.board.getTile(match.originX, match.originY);
                if (tile) {
                    tile.type = match.specialToCreate;
                }
            }
        }
    }

    private async clearMatches(matches: MatchResult[]) {
        const tilesToClear = new Set<TileData>();
        const specialsToActivate = new Set<TileData>();
        const specialOrigins = new Set<TileData>();

        for (const match of matches) {
            if (match.specialToCreate !== null) {
                const origin = this.board.getTile(match.originX, match.originY);
                if (origin) specialOrigins.add(origin);
            }
            for (const tile of match.tiles) {
                tilesToClear.add(tile);
                if (tile.type >= TileType.SPECIAL_STRIPED_H) {
                    specialsToActivate.add(tile);
                }
            }
        }

        // Don't clear the tiles that are becoming specials
        for (const origin of specialOrigins) {
            tilesToClear.delete(origin);
        }

        // Handle specials recursively
        if (specialsToActivate.size > 0) {
            // TELEGRAPH PHASE
            const telegraphs: { type: 'row' | 'col', index: number, tiles: TileData[] }[] = [];
            
            for (const special of specialsToActivate) {
                if (special.type === TileType.SPECIAL_STRIPED_H) {
                    const rowTiles: TileData[] = [];
                    for (let x = 0; x < this.board.width; x++) {
                        const t = this.board.getTile(x, special.y);
                        if (t) rowTiles.push(t);
                    }
                    telegraphs.push({ type: 'row', index: special.y, tiles: rowTiles });
                } else if (special.type === TileType.SPECIAL_STRIPED_V) {
                    const colTiles: TileData[] = [];
                    for (let y = 0; y < this.board.height; y++) {
                        const t = this.board.getTile(special.x, y);
                        if (t) colTiles.push(t);
                    }
                    telegraphs.push({ type: 'col', index: special.x, tiles: colTiles });
                }
            }

            if (telegraphs.length > 0) {
                await this.renderer.animateTelegraph(telegraphs);
            }

            // ACTIVATE PHASE
            for (const special of specialsToActivate) {
                this.activateSpecial(special, tilesToClear);
            }
        }

        const animations: Promise<void>[] = [];
        let points = 0;

        let sumX = 0;
        let sumY = 0;
        let count = 0;

        for (const tile of tilesToClear) {
            const sprite = this.renderer.getSprite(tile.id);
            if (sprite) {
                points += 10 * this.combo;
                
                sumX += sprite.x;
                sumY += sprite.y;
                count++;

                // FX
                this.fx.spawnSparkleBurst(sprite.x + this.renderer.container.x, sprite.y + this.renderer.container.y);

                animations.push(
                    new Promise<void>((resolve) => {
                        gsap.to(sprite, {
                            pixi: { scale: 1.4, alpha: 0, rotation: (Math.random() - 0.5) * 45 },
                            duration: 0.25,
                            ease: "back.in(2)",
                            onComplete: () => {
                                this.renderer.removeTileSprite(tile.id);
                                this.board.grid[tile.y][tile.x] = null;
                                resolve();
                            }
                        });
                    })
                );
            }
        }

        // Floating Score FX
        if (count > 0) {
            const centerX = (sumX / count) + this.renderer.container.x;
            const centerY = (sumY / count) + this.renderer.container.y;
            
            let targetPos = { x: 0, y: 0 };
            if ((window as any).getScorePosition) {
                targetPos = (window as any).getScorePosition();
            }

            this.fx.spawnFloatingScore(centerX, centerY, points, targetPos, () => {
                this.hud.updateScore(points);
                if ((window as any).punchScoreHUD) {
                    (window as any).punchScoreHUD();
                }
            });
        } else {
            // Fallback if no tiles (shouldn't happen for matches)
            this.hud.updateScore(points);
        }

        if (this.combo > 1 || specialsToActivate.size > 0) {
            this.fx.screenShake(4 * this.combo, 0.15);
        }

        await Promise.all(animations);
    }

    private activateSpecial(special: TileData, tilesToClear: Set<TileData>) {
        if (special.type === TileType.SPECIAL_STRIPED_H) {
            for (let x = 0; x < this.board.width; x++) {
                const t = this.board.getTile(x, special.y);
                if (t) tilesToClear.add(t);
            }
        } else if (special.type === TileType.SPECIAL_STRIPED_V) {
            for (let y = 0; y < this.board.height; y++) {
                const t = this.board.getTile(special.x, y);
                if (t) tilesToClear.add(t);
            }
        } else if (special.type === TileType.SPECIAL_BOMB) {
            // 3x3 area
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    const t = this.board.getTile(special.x + dx, special.y + dy);
                    if (t) tilesToClear.add(t);
                }
            }
        } else if (special.type === TileType.SPECIAL_WRAPPED) {
            // 5x5 area
            for (let dy = -2; dy <= 2; dy++) {
                for (let dx = -2; dx <= 2; dx++) {
                    const t = this.board.getTile(special.x + dx, special.y + dy);
                    if (t) tilesToClear.add(t);
                }
            }
        }
    }

    private async applyGravity() {
        const animations: Promise<void>[] = [];

        for (let x = 0; x < this.board.width; x++) {
            let emptySlots = 0;
            for (let y = this.board.height - 1; y >= 0; y--) {
                if (this.board.grid[y][x] === null) {
                    emptySlots++;
                } else if (emptySlots > 0) {
                    const tile = this.board.grid[y][x]!;
                    const newY = y + emptySlots;
                    
                    this.board.grid[newY][x] = tile;
                    this.board.grid[y][x] = null;
                    tile.y = newY;

                    const sprite = this.renderer.getSprite(tile.id);
                    if (sprite) {
                        const targetY = newY * TILE_SIZE + TILE_SIZE / 2;
                        const tl = gsap.timeline();
                        
                        tl.to(sprite, {
                            y: targetY,
                            duration: 0.2 + emptySlots * 0.05,
                            ease: "power2.in"
                        });
                        
                        // Squash and stretch on land
                        tl.to(sprite, {
                            pixi: { scaleY: 0.8, scaleX: 1.2 },
                            duration: 0.05,
                        });
                        tl.to(sprite, {
                            pixi: { scaleY: 1, scaleX: 1 },
                            duration: 0.1,
                            ease: "back.out(2)"
                        });

                        animations.push(new Promise<void>(resolve => { tl.then(() => resolve()); }));
                    }
                }
            }
        }

        await Promise.all(animations);
    }

    private async refillBoard() {
        const animations: Promise<void>[] = [];

        for (let x = 0; x < this.board.width; x++) {
            let emptySlots = 0;
            for (let y = 0; y < this.board.height; y++) {
                if (this.board.grid[y][x] === null) {
                    emptySlots++;
                }
            }

            for (let i = 0; i < emptySlots; i++) {
                const y = emptySlots - 1 - i;
                const tile = this.board.createRandomTile(x, y);
                this.board.grid[y][x] = tile;
                
                const sprite = this.renderer.createTileSprite(tile);
                sprite.y = -(i + 1) * TILE_SIZE;
                sprite.alpha = 0;
                
                const targetY = y * TILE_SIZE + TILE_SIZE / 2;
                const tl = gsap.timeline();
                
                tl.to(sprite, {
                    y: targetY,
                    alpha: 1,
                    duration: 0.4 + i * 0.05,
                    ease: "power2.out"
                });
                
                tl.to(sprite, {
                    pixi: { scaleY: 0.8, scaleX: 1.2 },
                    duration: 0.05,
                });
                tl.to(sprite, {
                    pixi: { scaleY: 1, scaleX: 1 },
                    duration: 0.1,
                    ease: "back.out(2)"
                });

                animations.push(new Promise<void>(resolve => { tl.then(() => resolve()); }));
            }
        }

        // Bot Analysis: Predict moves before visual drop
        const analysis = this.moveFinder.findAvailableMoves();
        console.log(`%c[Bot Analysis] Available Moves (Pre-Drop): ${analysis.total}`, 'color: #00ff00; font-weight: bold;');
        if (analysis.total > 0) {
            console.group('%cDetailed Analysis', 'color: #cccccc');
            
            // Log by Type
            console.log('%cBy Type:', 'color: #ffffff; font-weight: bold');
            Object.entries(analysis.byType).forEach(([type, count]) => {
                if (count > 0) console.log(`  ${type}: ${count}`);
            });

            // Log by Color
            console.log('%cBy Color:', 'color: #ffffff; font-weight: bold');
            Object.entries(analysis.byColor).forEach(([color, types]) => {
                const totalForColor = Object.values(types).reduce((a, b) => a + b, 0);
                if (totalForColor > 0) {
                    const details = Object.entries(types)
                        .filter(([_, count]) => count > 0)
                        .map(([t, c]) => `${t} (${c})`)
                        .join(', ');
                    
                    let colorStyle = 'color: #cccccc';
                    if (color === 'Red') colorStyle = 'color: #ff4444';
                    if (color === 'Blue') colorStyle = 'color: #4444ff';
                    if (color === 'Green') colorStyle = 'color: #44ff44';
                    if (color === 'Yellow') colorStyle = 'color: #ffff44';
                    if (color === 'Purple') colorStyle = 'color: #ff44ff';
                    if (color === 'Orange') colorStyle = 'color: #ffaa44';

                    console.log(`%c  ${color}: ${details}`, colorStyle);
                }
            });
            console.groupEnd();
        }

        await Promise.all(animations);
    }
}
