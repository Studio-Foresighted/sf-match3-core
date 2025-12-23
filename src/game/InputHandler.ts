import { Board, type TileData } from './logic/Board.ts';
import { BoardRenderer, TILE_SIZE } from './render/BoardRenderer.ts';
import { MatchResolver } from './logic/MatchResolver.ts';
import { MoveFinder } from './logic/MoveFinder.ts';
import { FXManager } from './fx/FXManager.ts';
import { HUD } from './render/HUD.ts';
import { gsap } from 'gsap';
import { Point, FederatedPointerEvent, Sprite } from 'pixi.js';

interface DragState {
    tile: TileData;
    sprite: Sprite;
    startPos: Point;      // Tile's initial position (pixels)
    offset: Point;        // Pointer offset from tile center
    targetPos: Point;     // Current target for the dragged tile
    
    pointerStart: Point;  // Pointer position at start of drag (local space)
    
    neighbor: TileData | null;
    neighborSprite: Sprite | null;
    neighborStartPos: Point | null;
    neighborTargetPos: Point | null;
}

export class InputHandler {
    private renderer: BoardRenderer;
    private board: Board;
    private resolver: MatchResolver;
    private moveFinder: MoveFinder;
    private hud: HUD;
    private dragState: DragState | null = null;
    private isLocked: boolean = false;
    private moves: number = 30;
    private idleTime: number = 0;
    private hintActive: boolean = false;

    constructor(renderer: BoardRenderer, board: Board, fx: FXManager, hud: HUD) {
        this.renderer = renderer;
        this.board = board;
        this.hud = hud;
        this.resolver = new MatchResolver(board, renderer, fx, hud);
        this.moveFinder = new MoveFinder(board);
    }

    reset() {
        this.moves = 30;
        this.isLocked = false;
        this.dragState = null;
        this.idleTime = 0;
        this.stopHint();
    }

    lock() {
        this.isLocked = true;
        this.stopHint();
    }

    enable() {
        this.renderer.container.eventMode = 'static';
        this.renderer.container.on('pointerdown', this.onPointerDown, this);
        this.renderer.container.on('pointermove', this.onPointerMove, this);
        this.renderer.container.on('pointerup', this.onPointerUp, this);
        this.renderer.container.on('pointerupoutside', this.onPointerUp, this);

        // Initial Bot Analysis on Load
        const analysis = this.moveFinder.findAvailableMoves();
        console.log(`%c[Bot Analysis] Initial Moves: ${analysis.total}`, 'color: #00ff00; font-weight: bold;');
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
    }

    update(dt: number) {
        // Idle Timer Logic
        if (!this.isLocked && !this.dragState) {
            this.idleTime += dt / 60; // Convert frames to seconds approx
            if (this.idleTime > 2 && !this.hintActive) { // 2 seconds idle (Twice as fast)
                this.triggerHint();
            }
        } else {
            this.idleTime = 0;
            if (this.hintActive) this.stopHint();
        }

        if (this.dragState && !this.isLocked) {
            const { sprite, targetPos } = this.dragState;
            const t = 0.5; 
            
            // Lerp dragged sprite
            sprite.x += (targetPos.x - sprite.x) * t;
            sprite.y += (targetPos.y - sprite.y) * t;
        }
    }

    private triggerHint() {
        const move = this.moveFinder.getRandomMove();
        if (move && move.involvedTiles.length > 0) {
            this.renderer.playHint(move.involvedTiles, move.specialToCreate);
            this.hintActive = true;
        }
    }

    private stopHint() {
        this.renderer.stopHint();
        this.hintActive = false;
    }

    private onPointerDown(e: FederatedPointerEvent) {
        this.idleTime = 0;
        if (this.hintActive) this.stopHint();

        if (this.isLocked) return;

        const localPos = this.renderer.container.toLocal(e.global);
        const x = Math.floor(localPos.x / TILE_SIZE);
        const y = Math.floor(localPos.y / TILE_SIZE);

        const tile = this.board.getTile(x, y);
        if (!tile) return;

        const sprite = this.renderer.getSprite(tile.id);
        if (!sprite) return;

        this.dragState = {
            tile,
            sprite,
            startPos: new Point(tile.x * TILE_SIZE + TILE_SIZE / 2, tile.y * TILE_SIZE + TILE_SIZE / 2),
            offset: new Point(sprite.x - localPos.x, sprite.y - localPos.y),
            targetPos: new Point(tile.x * TILE_SIZE + TILE_SIZE / 2, tile.y * TILE_SIZE + TILE_SIZE / 2),
            pointerStart: localPos.clone(),
            neighbor: null,
            neighborSprite: null,
            neighborStartPos: null,
            neighborTargetPos: null
        };

        // Visual feedback
        this.renderer.container.setChildIndex(sprite, this.renderer.container.children.length - 1);
        gsap.to(sprite.scale, { x: 1.15, y: 1.15, duration: 0.1, ease: "back.out(1.7)" });
        sprite.cursor = 'grabbing';
    }

    private onPointerMove(e: FederatedPointerEvent) {
        if (!this.dragState || this.isLocked) return;

        const localPos = this.renderer.container.toLocal(e.global);
        const { startPos, offset, tile } = this.dragState;
        
        // Calculate raw target position based on pointer
        let rawX = localPos.x + offset.x;
        let rawY = localPos.y + offset.y;
        
        // Calculate deltas from start
        let deltaX = rawX - startPos.x;
        let deltaY = rawY - startPos.y;

        // Determine dominant axis based on raw input
        const absX = Math.abs(deltaX);
        const absY = Math.abs(deltaY);
        const dominantAxis = absX > absY ? 'x' : 'y';

        // Clamp deltas to TILE_SIZE
        deltaX = Math.max(-TILE_SIZE, Math.min(TILE_SIZE, deltaX));
        deltaY = Math.max(-TILE_SIZE, Math.min(TILE_SIZE, deltaY));

        // Update target position (lock to dominant axis)
        if (dominantAxis === 'x') {
            this.dragState.targetPos.x = startPos.x + deltaX;
            this.dragState.targetPos.y = startPos.y;
        } else {
            this.dragState.targetPos.x = startPos.x;
            this.dragState.targetPos.y = startPos.y + deltaY;
        }

        const dominantDelta = dominantAxis === 'x' ? deltaX : deltaY;

        // 3. Neighbor Preview
        let neighborX = tile.x;
        let neighborY = tile.y;

        // Only select neighbor if we have moved enough (40% threshold)
        if (Math.abs(dominantDelta) > TILE_SIZE * 0.4) {
            if (dominantAxis === 'x') neighborX += Math.sign(deltaX);
            else neighborY += Math.sign(deltaY);
        }

        const potentialNeighbor = this.board.getTile(neighborX, neighborY);

        // If neighbor changed (or we went back to center), reset old one
        if (this.dragState.neighbor && this.dragState.neighbor !== potentialNeighbor) {
             this.resetNeighbor(this.dragState.neighborSprite, this.dragState.neighborStartPos);
             this.dragState.neighbor = null;
             this.dragState.neighborSprite = null;
             this.dragState.neighborStartPos = null;
             this.dragState.neighborTargetPos = null;
        }

        // Setup new neighbor if valid and different
        if (potentialNeighbor && potentialNeighbor !== tile && !this.dragState.neighbor) {
            const ns = this.renderer.getSprite(potentialNeighbor.id);
            if (ns) {
                this.dragState.neighbor = potentialNeighbor;
                this.dragState.neighborSprite = ns;
                this.dragState.neighborStartPos = new Point(
                    potentialNeighbor.x * TILE_SIZE + TILE_SIZE / 2, 
                    potentialNeighbor.y * TILE_SIZE + TILE_SIZE / 2
                );
                this.dragState.neighborTargetPos = new Point(
                    potentialNeighbor.x * TILE_SIZE + TILE_SIZE / 2, 
                    potentialNeighbor.y * TILE_SIZE + TILE_SIZE / 2
                );

                // Tween neighbor to hole
                gsap.killTweensOf(ns);
                gsap.to(ns, {
                    x: this.dragState.startPos.x,
                    y: this.dragState.startPos.y,
                    duration: 0.2,
                    ease: "power2.out"
                });
                if ((window as any).playAudioEvent) (window as any).playAudioEvent('preview_move');
            }
        }
    }

    private resetNeighbor(sprite: Sprite | null, startPos: Point | null) {
        if (sprite && startPos) {
             gsap.killTweensOf(sprite);
             gsap.to(sprite, { x: startPos.x, y: startPos.y, duration: 0.2, ease: "power2.out" });
        }
    }

    private async onPointerUp(_e: FederatedPointerEvent) {
        if (!this.dragState) return;
        
        const { tile, sprite, startPos, neighbor, neighborSprite, neighborStartPos, targetPos } = this.dragState;
        this.dragState = null;
        sprite.cursor = 'default';

        gsap.to(sprite.scale, { x: 1, y: 1, duration: 0.2, ease: "back.out(1.2)" });

        // Check if we should commit
        let commit = false;
        if (neighbor) {
            const deltaX = targetPos.x - startPos.x;
            const deltaY = targetPos.y - startPos.y;
            const absX = Math.abs(deltaX);
            const absY = Math.abs(deltaY);
            const dominantDist = Math.max(absX, absY);

            if (dominantDist > TILE_SIZE / 2) {
                commit = true;
            }
        }

        if (commit && neighbor) {
            if ((window as any).playAudioEvent) (window as any).playAudioEvent('swap');
            await this.handleSwap(tile, neighbor);
        } else {
            // Revert
            gsap.to(sprite, { x: startPos.x, y: startPos.y, duration: 0.3, ease: "elastic.out(1, 0.5)" });
            if (neighborSprite && neighborStartPos) {
                gsap.killTweensOf(neighborSprite);
                gsap.to(neighborSprite, { x: neighborStartPos.x, y: neighborStartPos.y, duration: 0.3, ease: "elastic.out(1, 0.5)" });
            }
        }
    }

    private async handleSwap(tile1: TileData, tile2: TileData) {
        if (this.moves <= 0) {
            // Revert if no moves
            const s1 = this.renderer.getSprite(tile1.id);
            const s2 = this.renderer.getSprite(tile2.id);
            if (s1) gsap.to(s1, { x: tile1.x * TILE_SIZE + TILE_SIZE / 2, y: tile1.y * TILE_SIZE + TILE_SIZE / 2, duration: 0.3, ease: "elastic.out(1, 0.5)" });
            if (s2) gsap.to(s2, { x: tile2.x * TILE_SIZE + TILE_SIZE / 2, y: tile2.y * TILE_SIZE + TILE_SIZE / 2, duration: 0.3, ease: "elastic.out(1, 0.5)" });
            return;
        }
        this.isLocked = true;

        // Perform swap in logic
        this.board.swap(tile1.x, tile1.y, tile2.x, tile2.y);
        
        // Animate swap (finish the move)
        await this.renderer.animateSwap(tile1, tile2);

        const matches = this.board.findMatches();
        if (matches.length > 0) {
            // Valid swap
            this.moves--;
            this.hud.updateMoves(this.moves);
            await this.resolver.resolve();
            
            // Check for No Moves -> Reshuffle
            await this.checkAndReshuffle();
        } else {
            // Invalid swap, roll back
            await this.renderer.animateNope(tile1, tile2);
            this.board.swap(tile1.x, tile1.y, tile2.x, tile2.y);
        }

        this.isLocked = false;
    }

    async checkAndReshuffle() {
        let moves = this.moveFinder.findAvailableMoves();
        if (moves.total === 0) {
            console.log("No moves detected! Reshuffling...");
            
            // Show some UI feedback?
            
            // Perform Reshuffle
            await this.renderer.performReshuffle(() => {
                this.board.reshuffle();
            });
            
            // Re-check (recursive if still no moves, though reshuffle tries to avoid this)
            await this.checkAndReshuffle();
        }
    }

    async forceReshuffle() {
        if (this.isLocked) return;
        this.isLocked = true;
        await this.renderer.performReshuffle(() => {
            this.board.reshuffle();
        });
        this.isLocked = false;
    }
}
