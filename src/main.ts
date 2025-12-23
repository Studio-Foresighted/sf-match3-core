import { Application, Graphics, Texture, Color } from 'pixi.js';
import { gsap } from 'gsap';
import { PixiPlugin } from 'gsap/PixiPlugin';
import { Game } from './game/Game.ts';
import { IntroSequence } from './game/IntroSequence.ts';

// Register GSAP PixiPlugin
gsap.registerPlugin(PixiPlugin);
PixiPlugin.registerPIXI({ Graphics, Texture, Color });

async function init() {
    const app = new Application();
    
    await app.init({
        resizeTo: window,
        backgroundColor: 0x000000, // Black background for intro
        resolution: window.devicePixelRatio || 1,
        antialias: true,
        autoDensity: true,
    });

    document.body.appendChild(app.canvas);
    document.body.style.margin = '0';
    document.body.style.overflow = 'hidden';
    document.body.style.backgroundColor = '#000000';

    let game: Game | null = null;
    let intro: IntroSequence | null = null;
    let isGameActive = false;

    // Global resize handler
    const resize = () => {
        const width = window.innerWidth;
        const height = window.innerHeight;

        if (!isGameActive && intro) {
            // Intro Mode: Full screen, no scaling on stage (handled inside IntroSequence)
            app.stage.scale.set(1);
            app.stage.x = 0;
            app.stage.y = 0;
            intro.resize();
            return;
        }
        
        if (isGameActive) {
            // Game Dimensions
            const TILE_SIZE = 140;
            const BOARD_SIZE = 8 * TILE_SIZE;
            const HEADER_HEIGHT = 320; // Increased space for logo
            const FOOTER_HEIGHT = 50;  // Padding below
            
            const totalGameWidth = BOARD_SIZE + 40; // Add some side padding
            const totalGameHeight = BOARD_SIZE + HEADER_HEIGHT + FOOTER_HEIGHT;
            
            // Calculate scale to fit the game in the window
            const scale = Math.min(width / totalGameWidth, height / totalGameHeight);
            
            app.stage.scale.set(scale);
            
            // Center horizontally
            app.stage.x = (width - BOARD_SIZE * scale) / 2;
            
            // Center vertically based on the visual center of the content
            const visualCenterY = (BOARD_SIZE - HEADER_HEIGHT) / 2;
            app.stage.y = (height / 2) - (visualCenterY * scale);

            // Update Logo Position
            if (game) {
                game.onResize(app.stage.y, scale, app.stage.x);
            }

            // Update HTML HUD Layout to match board position
            if ((window as any).updateHUDLayout) {
                (window as any).updateHUDLayout(
                    app.stage.x, 
                    app.stage.y, 
                    BOARD_SIZE * scale, 
                    scale
                );
            }
        }
    };

    window.addEventListener('resize', resize);

    // Start Intro
    intro = new IntroSequence(app, async () => {
        // Intro Complete Callback
        if (intro) {
            app.stage.removeChild(intro.container);
            intro = null;
        }

        // Initialize Game
        game = new Game(app);
        await game.init();
        isGameActive = true;
        resize(); // Apply game scaling
        
        // Fade in game (optional, handled by game init usually, but we can add a global fade)
        app.stage.alpha = 0;
        gsap.to(app.stage, { alpha: 1, duration: 0.5 });
    });

    app.stage.addChild(intro.container);
    
    // Start loading intro assets
    await intro.load();
    
    // Initial resize
    resize();
}

init();
