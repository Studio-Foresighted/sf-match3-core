import { Application, Container, Assets, Sprite } from 'pixi.js';
import { Board } from './logic/Board.ts';
import { BoardRenderer } from './render/BoardRenderer.ts';
import { InputHandler } from './InputHandler.ts';
import { FXManager } from './fx/FXManager.ts';
import { HUD } from './render/HUD.ts';

export class Game {
    private app: Application;
    private board: Board;
    private renderer: BoardRenderer;
    private input: InputHandler;
    private fx: FXManager;
    private hud: HUD;
    private gameContainer: Container;
    private background: Sprite | null = null;

    constructor(app: Application) {
        this.app = app;
        this.gameContainer = new Container();
        
        this.board = new Board(8, 8);
        this.fx = new FXManager(this.app);
        this.renderer = new BoardRenderer(this.app, this.board); 
        this.hud = new HUD();
        this.input = new InputHandler(this.renderer, this.board, this.fx, this.hud);

        this.app.stage.addChild(this.gameContainer);
        this.gameContainer.addChild(this.renderer.container);
        this.app.stage.addChild(this.hud.container);
    }

    async init() {
        // Load Assets
        const [bgTexture, logoTexture] = await Promise.all([
            Assets.load('/assets/artworx-alchemy-bg.png'),
            Assets.load('/assets/artworx-alchemy-trans.png')
        ]);

        // Setup Background
        this.background = new Sprite(bgTexture);
        this.background.anchor.set(0.5);
        // We'll position it in the center of the stage
        this.app.stage.addChildAt(this.background, 0);
        
        // Update HUD with logo
        this.hud.setLogo(logoTexture);

        await this.renderer.init();
        this.board.setup();
        this.renderer.renderFullBoard();
        this.input.enable();
        
        this.app.ticker.add((ticker) => {
            this.fx.update(ticker.deltaTime);
            this.input.update(ticker.deltaTime);
            
            if (this.background) {
                // Keep background centered on the visual center of the game
                // Visual center from main.ts logic: (BOARD_SIZE - HEADER_HEIGHT) / 2
                // BOARD_SIZE = 1120, HEADER_HEIGHT = 320 -> Center Y = 400
                const centerX = (8 * 140) / 2;
                const centerY = ((8 * 140) - 320) / 2;
                
                this.background.x = centerX;
                this.background.y = centerY;
                
                // Scale to cover the entire game area
                // We want it to cover the screen, but we are inside a scaled container.
                // The container is scaled to fit the screen.
                // So if we make the background huge relative to the game board, it will cover.
                // Let's make it cover a large area around the board.
                const targetSize = 3000; 
                const scale = Math.max(targetSize / this.background.texture.width, targetSize / this.background.texture.height);
                this.background.scale.set(scale);
            }
        });

        // Expose Reset
        (window as any).resetGame = () => this.reset();
        // Expose Lock
        (window as any).lockGameInput = () => this.input.lock();
        // Expose Force Reshuffle
        (window as any).forceReshuffle = () => this.input.forceReshuffle();
    }

    reset() {
        // 1. Reset Logic
        this.board.setup();
        
        // 2. Reset Renderer
        this.renderer.renderFullBoard();
        
        // 3. Reset HUD
        this.hud.reset();
        
        // 4. Reset Input
        this.input.reset();
        
        // 5. Reset Stars (HTML)
        if ((window as any).updateStarRating) {
            (window as any).updateStarRating(0);
        }
    }

    onResize(stageY: number, scale: number) {
        this.hud.updateLogoPosition(stageY, scale);
    }
}
