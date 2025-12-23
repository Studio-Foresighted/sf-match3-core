import { Application, Container, Graphics, Sprite, Texture, Text, TextStyle } from 'pixi.js';
import { gsap } from 'gsap';

interface Particle {
    sprite: Sprite;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
}

export class FXManager {
    private app: Application;
    private particleContainer: Container;
    private particles: Particle[] = [];
    private textures: Map<string, Texture> = new Map();

    constructor(app: Application) {
        this.app = app;
        this.particleContainer = new Container();
        this.app.stage.addChild(this.particleContainer);
        this.createTextures();
    }

    spawnShockwave(_x: number, _y: number) {
        // Placeholder for shockwave
        // Filters removed for v8 compatibility
    }

    private createTextures() {
        const g = new Graphics();
        
        // Sparkle texture
        g.clear();
        g.circle(0, 0, 4);
        g.fill(0xffffff);
        this.textures.set('sparkle', this.app.renderer.generateTexture(g));

        // Debris texture
        g.clear();
        g.poly([0, -4, 4, 4, -4, 4]);
        g.fill(0xffffff);
        this.textures.set('debris', this.app.renderer.generateTexture(g));
    }

    spawnSparkleBurst(x: number, y: number, color: number = 0xffffff) {
        for (let i = 0; i < 12; i++) {
            const sprite = new Sprite(this.textures.get('sparkle'));
            sprite.anchor.set(0.5);
            sprite.x = x;
            sprite.y = y;
            sprite.tint = color;
            sprite.blendMode = 'add';
            
            const angle = Math.random() * Math.PI * 2;
            const speed = 2 + Math.random() * 4;
            
            this.particles.push({
                sprite,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1,
                maxLife: 0.5 + Math.random() * 0.5
            });
            
            this.particleContainer.addChild(sprite);
        }
    }

    screenShake(intensity: number = 5, duration: number = 0.2) {
        const stage = this.app.stage;
        const originalX = stage.x;
        const originalY = stage.y;

        gsap.to(stage, {
            x: originalX + (Math.random() - 0.5) * intensity,
            y: originalY + (Math.random() - 0.5) * intensity,
            duration: 0.05,
            repeat: Math.floor(duration / 0.05),
            yoyo: true,
            onComplete: () => {
                stage.x = originalX;
                stage.y = originalY;
            }
        });
    }

    update(dt: number) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.life -= dt / 60; // Assuming 60fps for dt=1
            
            p.sprite.x += p.vx;
            p.sprite.y += p.vy;
            p.sprite.alpha = p.life;
            p.sprite.scale.set(p.life);
            p.sprite.rotation += 0.1;

            if (p.life <= 0) {
                this.particleContainer.removeChild(p.sprite);
                this.particles.splice(i, 1);
            }
        }
    }

    spawnFloatingScore(x: number, y: number, amount: number, targetScreenPos: {x: number, y: number}, onComplete: () => void) {
        const style = new TextStyle({
            fontFamily: 'Lilita One',
            fontSize: 90, // Much bigger (was 48)
            fill: '#ffffff',
            stroke: { color: '#000000', width: 9 },
            dropShadow: {
                alpha: 0.5,
                angle: Math.PI / 6,
                blur: 4,
                color: '#000000',
                distance: 4,
            },
        });

        const text = new Text({ text: `+${amount}`, style });
        text.anchor.set(0.5);
        text.x = x;
        text.y = y;
        text.scale.set(0);
        
        // Add to stage directly to be above everything, or particle container if it supports text (it usually doesn't well)
        // Let's add to app.stage for now to ensure it's on top
        this.app.stage.addChild(text);

        // Convert screen target to stage local
        const stageScale = this.app.stage.scale.x;
        const targetX = (targetScreenPos.x - this.app.stage.x) / stageScale;
        const targetY = (targetScreenPos.y - this.app.stage.y) / stageScale;

        const tl = gsap.timeline({
            onComplete: () => {
                this.app.stage.removeChild(text);
                text.destroy();
                onComplete();
            }
        });

        // 1. Pop in (Scale) - Start HUGE
        tl.to(text.scale, { x: 1.5, y: 1.5, duration: 0.25, ease: "back.out(2)" })
          .to(text.scale, { x: 1.0, y: 1.0, duration: 0.15 });
          
        // 2. Float up slightly (Position) - Concurrent with pop in
        tl.to(text, { y: y - 60, duration: 0.4, ease: "power1.out" }, 0);
          
        // 3. Fly to HUD
        tl.to(text, { 
              x: targetX, 
              y: targetY, 
              duration: 0.7, 
              ease: "power2.in" 
          }, ">") // Start after previous animations finish
          
          // Scale down smoothly during the flight to fit into the HUD
          .to(text.scale, { x: 0.25, y: 0.25, duration: 0.7, ease: "power2.in" }, "<")
          .to(text, { alpha: 0, duration: 0.15 }, ">-0.15");
    }
}
