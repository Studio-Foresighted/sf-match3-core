import { Container, Text, TextStyle, Sprite, Texture } from 'pixi.js';

export class HUD {
    public container: Container;
    private titleText: Text | null = null;
    private logoSprite: Sprite | null = null;
    private score: number = 0;
    private moves: number = 30;

    constructor() {
        this.container = new Container();
        // Pixi HUD elements removed in favor of HTML UI
    }

    setLogo(texture: Texture) {
        if (this.titleText) {
            this.container.removeChild(this.titleText);
            this.titleText.destroy();
            this.titleText = null;
        }

        this.logoSprite = new Sprite(texture);
        this.logoSprite.anchor.set(0.5, 1); // Anchor at bottom-center
        this.logoSprite.x = (8 * 140) / 2;
        this.logoSprite.y = -40; // Default desktop position
        
        // Scale logo to fit nicely (max width 80% of board, max height 300px)
        const maxWidth = (8 * 140) * 0.8;
        const maxHeight = 300;
        
        const scaleX = maxWidth / this.logoSprite.texture.width;
        const scaleY = maxHeight / this.logoSprite.texture.height;
        const scale = Math.min(scaleX, scaleY, 1.0); // Don't upscale if smaller
        
        this.logoSprite.scale.set(scale);

        this.container.addChild(this.logoSprite);
    }

    updateLogoPosition(stageY: number, scale: number) {
        if (!this.logoSprite) return;

        const isMobile = window.innerWidth <= 768;
        if (isMobile) {
            // We want the logo to be at screen Y = 20px
            // ScreenY = stageY + (LocalY * scale)
            // LocalY = (ScreenY - stageY) / scale
            const targetScreenY = 20;
            const localY = (targetScreenY - stageY) / scale;
            
            this.logoSprite.y = localY;
            this.logoSprite.anchor.set(0.5, 0); // Anchor top-center
        } else {
            // Reset to desktop default
            this.logoSprite.y = -40;
            this.logoSprite.anchor.set(0.5, 1); // Anchor bottom-center
        }
    }

    updateScore(points: number) {
        this.score += points;
        if ((window as any).updateHUD) {
            (window as any).updateHUD(this.score, this.moves);
        }
    }

    updateMoves(moves: number) {
        this.moves = moves;
        if ((window as any).updateHUD) {
            (window as any).updateHUD(this.score, this.moves);
        }
    }

    reset() {
        this.score = 0;
        this.moves = 30;
        if ((window as any).updateHUD) {
            (window as any).updateHUD(this.score, this.moves);
        }
    }
}
