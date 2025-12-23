import { Container, Graphics, Sprite, Texture, Application, BlurFilter } from 'pixi.js';
import { Board, type TileData, TileType } from '../logic/Board.ts';
import { gsap } from 'gsap';

export const TILE_SIZE = 140;
export const BOARD_OFFSET_X = 0;
export const BOARD_OFFSET_Y = 0;

export class BoardRenderer {
    public container: Container;
    private board: Board;
    private app: Application;
    private tileSprites: Map<number, Sprite> = new Map();
    private textures: Map<TileType, Texture> = new Map();
    private activeShimmers: Sprite[] = [];
    public isAnimatingReshuffle: boolean = false;

    constructor(app: Application, board: Board) {
        this.app = app;
        this.board = board;
        this.container = new Container();
        this.container.x = BOARD_OFFSET_X;
        this.container.y = BOARD_OFFSET_Y;
    }

    async init() {
        this.generateTextures();
    }

    private generateTextures() {
        const g = new Graphics();
        const colors: Record<number, number> = {
            [TileType.RED]: 0xff4444,
            [TileType.BLUE]: 0x4444ff,
            [TileType.GREEN]: 0x44ff44,
            [TileType.YELLOW]: 0xffff44,
            [TileType.PURPLE]: 0xaa44ff,
            [TileType.ORANGE]: 0xffaa44,
            [TileType.SPECIAL_STRIPED_H]: 0xffffff,
            [TileType.SPECIAL_STRIPED_V]: 0xffffff,
            [TileType.SPECIAL_BOMB]: 0x333333,
            [TileType.SPECIAL_WRAPPED]: 0x000000,
            [TileType.SPECIAL_COLOR_BOMB]: 0x111111,
        };

        for (const [typeStr, color] of Object.entries(colors)) {
            const type = Number(typeStr) as TileType;
            g.clear();
            
            if (type === TileType.SPECIAL_STRIPED_H || type === TileType.SPECIAL_STRIPED_V) {
                g.roundRect(0, 0, TILE_SIZE - 4, TILE_SIZE - 4, 12);
                g.fill(0xffffff);
                g.stroke({ width: 4, color: 0x00ffff });
                // Stripes
                const isH = type === TileType.SPECIAL_STRIPED_H;
                for (let i = 0; i < 4; i++) {
                    const offset = (i + 1) * (TILE_SIZE / 5);
                    if (isH) {
                        g.moveTo(0, offset);
                        g.lineTo(TILE_SIZE, offset);
                    } else {
                        g.moveTo(offset, 0);
                        g.lineTo(offset, TILE_SIZE);
                    }
                }
                g.stroke({ width: 6, color: 0x00ffff, alpha: 0.5 });
            } else if (type === TileType.SPECIAL_BOMB) {
                g.circle(TILE_SIZE/2, TILE_SIZE/2, TILE_SIZE/2 - 4);
                g.fill(0x333333);
                g.stroke({ width: 4, color: 0xff0000 });
            } else if (type === TileType.SPECIAL_WRAPPED) {
                g.roundRect(0, 0, TILE_SIZE - 4, TILE_SIZE - 4, 8);
                g.fill(0x000000);
                g.stroke({ width: 6, color: 0xffaa00 });
            } else if (type === TileType.SPECIAL_COLOR_BOMB) {
                g.star(TILE_SIZE/2, TILE_SIZE/2, 5, TILE_SIZE/2 - 4);
                g.fill(0x111111);
                g.stroke({ width: 4, color: 0xffffff });
            } else {
                g.roundRect(0, 0, TILE_SIZE - 4, TILE_SIZE - 4, 12);
                g.fill(color);
                g.stroke({ width: 2, color: 0xffffff, alpha: 0.5 });
            }
            
            // Add some "shine"
            g.beginPath();
            g.ellipse(TILE_SIZE/4, TILE_SIZE/4, TILE_SIZE/6, TILE_SIZE/8);
            g.fill({ color: 0xffffff, alpha: 0.3 });

            const tex = this.app.renderer.generateTexture(g);
            this.textures.set(Number(type) as TileType, tex);
        }
    }

    renderFullBoard() {
        if (this.isAnimatingReshuffle) return; // Block rendering during reshuffle animation
        this.container.removeChildren();
        this.tileSprites.clear();

        for (let y = 0; y < this.board.height; y++) {
            for (let x = 0; x < this.board.width; x++) {
                const tile = this.board.getTile(x, y);
                if (tile) {
                    this.createTileSprite(tile);
                }
            }
        }
    }
    async performReshuffle(logicFn: () => void) {
        this.isAnimatingReshuffle = true;
        const timeline = gsap.timeline();
        const sprites = Array.from(this.tileSprites.values());
        
        // 1. Explode / Scatter (Visual Only)
        // Sprites are currently at their OLD positions.
        await new Promise<void>(resolve => {
            timeline.to(sprites, {
                x: () => Math.random() * (this.board.width * TILE_SIZE),
                y: () => Math.random() * (this.board.height * TILE_SIZE),
                rotation: () => (Math.random() - 0.5) * Math.PI,
                scaleX: 0.6,
                scaleY: 0.6,
                alpha: 0.8,
                duration: 0.4,
                ease: "power2.inOut",
                stagger: {
                    amount: 0.2,
                    from: "random"
                }
            });

            // 2. Run Logic (Update Grid Data)
            // This updates tile.x/y to new positions, but we blocked the renderer
            // so sprites won't snap yet.
            timeline.call(() => {
                logicFn();
            });

            // 3. Reassemble to NEW positions
            // We calculate targets based on the NEW grid data
            const targets: {sprite: Sprite, x: number, y: number}[] = [];
            
            // We need to defer this calculation until AFTER logicFn runs
            // So we add another call or build the timeline dynamically?
            // GSAP timelines are built upfront. We need to use a function-based value or add to timeline later.
            // Let's use a callback to build the second part of the animation.
            
            timeline.call(() => {
                // Logic has run. Now calculate new targets.
                const reassembleTL = gsap.timeline();
                
                // We need to map sprites to their NEW positions.
                // Since we swapped TileData objects, the ID is still on the object.
                // So tileSprites.get(tile.id) gives us the sprite for that logical tile.
                // And tile.x/y is the NEW position.
                
                const moveTargets: {sprite: Sprite, x: number, y: number}[] = [];

                for(let y=0; y<this.board.height; y++) {
                    for(let x=0; x<this.board.width; x++) {
                        const tile = this.board.getTile(x, y);
                        if (tile) {
                            const sprite = this.tileSprites.get(tile.id);
                            if (sprite) {
                                moveTargets.push({
                                    sprite,
                                    x: x * TILE_SIZE + TILE_SIZE/2,
                                    y: y * TILE_SIZE + TILE_SIZE/2
                                });
                            }
                        }
                    }
                }

                // Shuffle the order of flying in
                for (let i = moveTargets.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [moveTargets[i], moveTargets[j]] = [moveTargets[j], moveTargets[i]];
                }

                moveTargets.forEach(({sprite, x, y}, i) => {
                    reassembleTL.to(sprite, {
                        x: x,
                        y: y,
                        rotation: 0,
                        scaleX: 1,
                        scaleY: 1,
                        alpha: 1,
                        duration: 0.5,
                        ease: "back.out(1.5)"
                    }, i * 0.005); 
                });
                
                // Settle Pop
                reassembleTL.to(sprites, {
                    scaleX: 1.1,
                    scaleY: 1.1,
                    duration: 0.1,
                    yoyo: true,
                    repeat: 1,
                    ease: "sine.inOut",
                    stagger: {
                        amount: 0.2,
                        grid: [this.board.width, this.board.height],
                        from: "center"
                    }
                });
            });

            timeline.eventCallback("onComplete", () => {
                this.isAnimatingReshuffle = false;
                // Ensure everything is perfectly snapped and textures updated
                this.refreshSpriteTextures();
                resolve();
            });
        });
    }

    refreshSpriteTextures() {
        for (let y = 0; y < this.board.height; y++) {
            for (let x = 0; x < this.board.width; x++) {
                const tile = this.board.getTile(x, y);
                if (tile) {
                    const sprite = this.tileSprites.get(tile.id);
                    if (sprite) {
                        const tex = this.textures.get(tile.type);
                        if (tex) sprite.texture = tex;
                    }
                }
            }
        }
    }
    createTileSprite(tile: TileData): Sprite {
        const sprite = new Sprite(this.textures.get(tile.type));
        sprite.anchor.set(0.5);
        sprite.x = tile.x * TILE_SIZE + TILE_SIZE / 2;
        sprite.y = tile.y * TILE_SIZE + TILE_SIZE / 2;
        this.container.addChild(sprite);
        this.tileSprites.set(tile.id, sprite);
        return sprite;
    }

    getSprite(tileId: number): Sprite | undefined {
        return this.tileSprites.get(tileId);
    }

    async animateTelegraph(telegraphs: { type: 'row' | 'col', index: number, tiles: TileData[] }[]) {
        if (telegraphs.length === 0) return;

        const overlay = new Container();
        this.container.addChild(overlay);
        
        const tl = gsap.timeline();

        for (const tele of telegraphs) {
            // Sort tiles by position for sequential effect
            const sortedTiles = [...tele.tiles].sort((a, b) => 
                tele.type === 'row' ? a.x - b.x : a.y - b.y
            );

            // 1. Arming Phase (Pulse)
            sortedTiles.forEach(tile => {
                const sprite = this.getSprite(tile.id);
                if (!sprite) return;

                const highlight = new Graphics();
                highlight.roundRect(-TILE_SIZE/2 + 4, -TILE_SIZE/2 + 4, TILE_SIZE - 8, TILE_SIZE - 8, 10);
                highlight.stroke({ width: 3, color: 0xffffff, alpha: 0.8 });
                highlight.fill({ color: 0xffffff, alpha: 0.2 });
                highlight.blendMode = 'add';
                highlight.x = sprite.x;
                highlight.y = sprite.y;
                highlight.alpha = 0;
                overlay.addChild(highlight);

                tl.to(highlight, { alpha: 1, duration: 0.2, ease: "power2.out" }, 0);
                tl.to(highlight.scale, { x: 1.1, y: 1.1, duration: 0.2, yoyo: true, repeat: 1 }, 0);
            });

            // 2. Sweep Phase
            const isRow = tele.type === 'row';
            const beam = new Graphics();
            
            // Create a gradient-like beam using multiple rects or a texture (using simple rects for perf)
            // Core beam
            beam.rect(
                isRow ? 0 : -TILE_SIZE/2, 
                isRow ? -TILE_SIZE/2 : 0, 
                isRow ? TILE_SIZE/2 : TILE_SIZE, 
                isRow ? TILE_SIZE : TILE_SIZE/2
            );
            beam.fill({ color: 0xffffff, alpha: 1 });
            beam.filters = [new BlurFilter({ strength: 15, quality: 2 })];
            beam.blendMode = 'add';
            
            // Start position
            const startX = isRow ? (sortedTiles[0].x - 1) * TILE_SIZE + TILE_SIZE/2 : (sortedTiles[0].x) * TILE_SIZE + TILE_SIZE/2;
            const startY = isRow ? (sortedTiles[0].y) * TILE_SIZE + TILE_SIZE/2 : (sortedTiles[0].y - 1) * TILE_SIZE + TILE_SIZE/2;
            
            // End position
            const endX = isRow ? (sortedTiles[sortedTiles.length-1].x + 2) * TILE_SIZE + TILE_SIZE/2 : startX;
            const endY = isRow ? startY : (sortedTiles[sortedTiles.length-1].y + 2) * TILE_SIZE + TILE_SIZE/2;

            beam.x = startX;
            beam.y = startY;
            beam.alpha = 0;
            overlay.addChild(beam);

            const sweepDuration = 0.4;
            const sweepStart = 0.25;

            tl.to(beam, { alpha: 1, duration: 0.1 }, sweepStart);
            tl.to(beam, { 
                x: endX, 
                y: endY, 
                duration: sweepDuration, 
                ease: "power1.inOut" 
            }, sweepStart);
            tl.to(beam, { alpha: 0, duration: 0.1 }, sweepStart + sweepDuration - 0.1);

            // Per-tile micro flash triggered by sweep
            sortedTiles.forEach((tile, i) => {
                const sprite = this.getSprite(tile.id);
                if (!sprite) return;

                const flash = new Graphics();
                flash.rect(-TILE_SIZE/2, -TILE_SIZE/2, TILE_SIZE, TILE_SIZE);
                flash.fill({ color: 0xffffff, alpha: 1 });
                flash.blendMode = 'add';
                flash.x = sprite.x;
                flash.y = sprite.y;
                flash.alpha = 0;
                overlay.addChild(flash);

                // Calculate delay based on position in line
                const progress = i / sortedTiles.length;
                const hitTime = sweepStart + (progress * sweepDuration);

                tl.to(flash, { alpha: 0.8, duration: 0.05 }, hitTime);
                tl.to(flash, { alpha: 0, duration: 0.15 }, hitTime + 0.05);
            });
        }

        // 3. Commit Phase (Final Flash)
        tl.to(overlay, { alpha: 0, duration: 0.1 }, ">");

        await tl.then();
        this.container.removeChild(overlay);
        overlay.destroy({ children: true });
    }

    removeTileSprite(tileId: number) {
        const sprite = this.tileSprites.get(tileId);
        if (sprite) {
            this.container.removeChild(sprite);
            this.tileSprites.delete(tileId);
        }
    }

    private hintTween: gsap.core.Timeline | null = null;

    playHint(tiles: TileData[], specialToCreate: TileType | null = null) {
        this.stopHint();

        if (tiles.length === 0) return;

        // Shake parameters
        const shakeAmt = 4; // Slightly reduced for smoothness
        const duration = 0.8; // Much slower (was 0.35)

        this.hintTween = gsap.timeline({ repeat: -1, repeatDelay: 1.5 });
        
        // Animate all involved tiles
        for (const tile of tiles) {
            const sprite = this.getSprite(tile.id);
            if (!sprite) continue;

            const baseX = tile.x * TILE_SIZE + TILE_SIZE / 2;
            const baseY = tile.y * TILE_SIZE + TILE_SIZE / 2;

            // Shake - Smooth Sine Wave
            this.hintTween.to(sprite, { x: baseX + shakeAmt, duration: duration * 0.25, ease: "sine.inOut" }, 0)
                          .to(sprite, { x: baseX - shakeAmt, duration: duration * 0.25, ease: "sine.inOut" }, ">")
                          .to(sprite, { x: baseX + shakeAmt * 0.5, duration: duration * 0.25, ease: "sine.inOut" }, ">")
                          .to(sprite, { x: baseX, duration: duration * 0.25, ease: "sine.inOut" }, ">");

            // Squash/Stretch - Gentle pulse
            this.hintTween.to(sprite, { 
                pixi: { scaleX: 1.04, scaleY: 0.96 }, 
                duration: duration * 0.5, 
                yoyo: true, 
                repeat: 1, 
                ease: "sine.inOut" 
            }, 0);

            // Shimmer (Additive Overlay)
            const shimmer = new Sprite(Texture.WHITE);
            shimmer.anchor.set(0.5);
            shimmer.alpha = 0;
            shimmer.blendMode = 'add';
            
            // Customize shimmer based on special result
            if (specialToCreate === TileType.SPECIAL_STRIPED_H) {
                shimmer.width = TILE_SIZE;
                shimmer.height = TILE_SIZE / 3; // Horizontal strip
            } else if (specialToCreate === TileType.SPECIAL_STRIPED_V) {
                shimmer.width = TILE_SIZE / 3; // Vertical strip
                shimmer.height = TILE_SIZE;
            } else {
                shimmer.width = TILE_SIZE - 10;
                shimmer.height = TILE_SIZE - 10;
            }

            sprite.addChild(shimmer);
            this.activeShimmers.push(shimmer);

            this.hintTween.to(shimmer, {
                alpha: 0.5, // 50% brightness
                duration: duration * 0.5,
                yoyo: true,
                repeat: 1,
                ease: "sine.inOut"
            }, 0);
        }
    }

    stopHint() {
        // Clean up shimmers
        for (const s of this.activeShimmers) {
            s.destroy();
        }
        this.activeShimmers = [];

        if (this.hintTween) {
            this.hintTween.kill();
            this.hintTween = null;
            
            // Reset all sprites to their correct positions
            for (let y = 0; y < this.board.height; y++) {
                for (let x = 0; x < this.board.width; x++) {
                    const tile = this.board.grid[y][x];
                    if (tile) {
                        const sprite = this.getSprite(tile.id);
                        if (sprite) {
                            gsap.killTweensOf(sprite);
                            sprite.x = x * TILE_SIZE + TILE_SIZE / 2;
                            sprite.y = y * TILE_SIZE + TILE_SIZE / 2;
                            sprite.scale.set(1);
                            // Ensure no children (shimmers) are left if something went wrong
                            if (sprite.children.length > 0) {
                                sprite.removeChildren();
                            }
                        }
                    }
                }
            }
        }
    }

    async animateSwap(tile1: TileData, tile2: TileData, _reverse: boolean = false): Promise<void> {
        const s1 = this.getSprite(tile1.id);
        const s2 = this.getSprite(tile2.id);
        if (!s1 || !s2) return;

        const duration = 0.18;
        const ease = "power2.out";

        const tl = gsap.timeline();
        
        tl.to(s1, {
            x: tile1.x * TILE_SIZE + TILE_SIZE / 2,
            y: tile1.y * TILE_SIZE + TILE_SIZE / 2,
            pixi: { scale: 1.06 },
            duration: duration / 2,
            ease: ease
        });
        tl.to(s1, { pixi: { scale: 1 }, duration: duration / 2 });

        tl.to(s2, {
            x: tile2.x * TILE_SIZE + TILE_SIZE / 2,
            y: tile2.y * TILE_SIZE + TILE_SIZE / 2,
            duration: duration,
            ease: ease
        }, 0);

        await tl;
    }

    async animateNope(tile1: TileData, tile2: TileData): Promise<void> {
        const s1 = this.getSprite(tile1.id);
        const s2 = this.getSprite(tile2.id);
        if (!s1 || !s2) return;

        const duration = 0.25;
        const tl = gsap.timeline();

        // Animate back to original positions (undo the swap)
        // Since logic is still swapped, T1 is at the "new" position, T2 is at the "old" position.
        // We want S1 to go to where T2 is, and S2 to go to where T1 is.
        tl.to(s1, {
            x: tile2.x * TILE_SIZE + TILE_SIZE / 2,
            y: tile2.y * TILE_SIZE + TILE_SIZE / 2,
            duration: duration,
            ease: "power2.inOut"
        });
        tl.to(s2, {
            x: tile1.x * TILE_SIZE + TILE_SIZE / 2,
            y: tile1.y * TILE_SIZE + TILE_SIZE / 2,
            duration: duration,
            ease: "power2.inOut"
        }, 0);

        // Shake board
        tl.to(this.container, {
            x: BOARD_OFFSET_X + (Math.random() - 0.5) * 10,
            y: BOARD_OFFSET_Y + (Math.random() - 0.5) * 10,
            duration: 0.05,
            repeat: 3,
            yoyo: true
        }, 0);
        tl.to(this.container, { x: BOARD_OFFSET_X, y: BOARD_OFFSET_Y, duration: 0.05 });

        await tl;
    }
}
