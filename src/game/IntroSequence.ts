import { Container, Sprite, Assets, Graphics, Text, TextStyle, Texture, Application } from 'pixi.js';
import { gsap } from 'gsap';

export class IntroSequence {
    private app: Application;
    public container: Container;
    private onComplete: () => void;
    private background: Sprite | null = null;
    private introVideoSprite: Sprite | null = null;
    private loopVideoSprite: Sprite | null = null;
    private startButton: Sprite | null = null;

    private introFrame: Graphics | null = null;
    private isMuted: boolean = false;

    private logoSprite: Sprite | null = null;
    private clickToStartText: Text | null = null;
    private logoScaleMultiplier: number = 1;
    private started: boolean = false;

    constructor(app: Application, onComplete: () => void) {
        this.app = app;
        this.onComplete = onComplete;
        this.container = new Container();
        
        // Global ESC listener
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                // Only trigger selection if we haven't started yet (container visible)
                if (this.container.alpha > 0) {
                    this.showCharacterSelection();
                }
            }
        });

        // Handle resize
        window.addEventListener('resize', () => this.resize());

        // Listen for mute toggle from HTML button
        window.addEventListener('toggleMute', (e: any) => {
            this.isMuted = !this.isMuted; // Toggle internal state
            // Update video if playing
            const introSource = this.introVideoSprite?.texture.source.resource;
            if (introSource && introSource.tagName === 'VIDEO') {
                introSource.muted = this.isMuted;
            }
            // Update UI
            if ((window as any).setMuteState) {
                (window as any).setMuteState(this.isMuted);
            }
        });

        this.resize();
    }

    async load() {
        // Load static background first
        const bgTexture = await Assets.load('/assets/artworx-alchemy-bg.png');

        this.background = new Sprite(bgTexture);
        this.background.anchor.set(0.5);
        this.background.alpha = 0; // Start hidden
        this.container.addChildAt(this.background, 0);
        
        this.resize(); // Ensure BG is positioned

        // Fade in BG
        await gsap.to(this.background, { alpha: 1, duration: 1 });

        // Show HTML Loader NOW
        if ((window as any).showLoader) {
            (window as any).showLoader();
        }
        
        // Load videos, button, and logo
        Assets.add({ alias: 'introVideo', src: '/assets/video/artworx-alchemy-intro.mp4' });
        Assets.add({ alias: 'loopVideo', src: '/assets/video/start-screen-loop-bg.mp4' });
        Assets.add({ alias: 'startButton', src: '/assets/start-button.png' });
        Assets.add({ alias: 'logo', src: '/assets/artworx-alchemy-trans.png' });

        const assetsToLoad = ['introVideo', 'loopVideo', 'startButton', 'logo'];
        
        // Load them
        await Assets.load(assetsToLoad, (progress) => {
            if ((window as any).setLoadingProgress) {
                (window as any).setLoadingProgress(progress);
            }
        });
        
        if ((window as any).setLoadingProgress) {
            (window as any).setLoadingProgress(1);
        }
        
        // Wait for the HTML loader to finish its animation/fake duration
        const onLoadingComplete = async () => {
            window.removeEventListener('loadingComplete', onLoadingComplete);
            // Ensure fonts are loaded before creating text
            await document.fonts.ready;
            this.setupLogoState();
        };
        window.addEventListener('loadingComplete', onLoadingComplete);
    }

    setupLogoState() {
        if (this.logoSprite) return; // Prevent double initialization

        // Setup Logo
        const logoTexture = Assets.get('logo');
        this.logoSprite = new Sprite(logoTexture);
        this.logoSprite.anchor.set(0.5);
        this.logoSprite.alpha = 0;
        this.container.addChild(this.logoSprite);

        // Breathing animation
        gsap.to(this.logoSprite, { alpha: 1, duration: 1 });
        
        // Use a multiplier so resize() can still control the base scale
        const animObj = { multiplier: 1 };
        gsap.to(animObj, {
            multiplier: 1.05,
            duration: 2,
            yoyo: true,
            repeat: -1,
            ease: "sine.inOut",
            onUpdate: () => {
                if (this.logoSprite) {
                    this.logoScaleMultiplier = animObj.multiplier;
                    this.resize();
                }
            }
        });

        // Click to start text (optional but helpful)
        const style = new TextStyle({
            fontFamily: ['Lilita One', 'Arial', 'sans-serif'], // Robust fallback
            fontSize: 36, 
            fill: '#ffffff',
            fontWeight: 'bold',
            align: 'center',
            dropShadow: {
                alpha: 0.5,
                angle: Math.PI / 6,
                blur: 4,
                color: '#000000',
                distance: 3,
            },
        });
        this.clickToStartText = new Text({ text: 'CLICK TO START', style });
        this.clickToStartText.anchor.set(0.5);
        this.clickToStartText.alpha = 0;
        this.container.addChild(this.clickToStartText);
        
        gsap.to(this.clickToStartText, { alpha: 1, duration: 1, delay: 1, yoyo: true, repeat: -1 });

        // Make text interactive for mobile touch
        this.clickToStartText.eventMode = 'static';
        this.clickToStartText.cursor = 'pointer';
        this.clickToStartText.on('pointertap', () => this.startVideoSequence());

        // Interaction to start video (background/container)
        this.container.eventMode = 'static';
        this.container.cursor = 'pointer';
        this.container.on('pointertap', () => this.startVideoSequence());
        
        this.resize();
    }

    startVideoSequence() {
        if (this.started) return;
        this.started = true;

        // Check for interaction/audio start
        let delay = 0;
        if (!(window as any).hasInteracted) {
            if ((window as any).playAudioEvent) (window as any).playAudioEvent('init');
            (window as any).hasInteracted = true;
            delay = 3; // 3s delay if this is the first interaction
        }

        if ((window as any).playAudioEvent) (window as any).playAudioEvent('intro_start');
        
        // Remove logo and text
        if (this.logoSprite) {
            gsap.to(this.logoSprite, { alpha: 0, duration: 0.5 });
        }
        if (this.clickToStartText) {
            gsap.to(this.clickToStartText, { alpha: 0, duration: 0.5, onComplete: () => {
                if (this.clickToStartText) this.clickToStartText.visible = false;
            }});
        }

        if (delay > 0) {
            gsap.delayedCall(delay, () => this.setupIntro());
        } else {
            this.setupIntro();
        }
    }

    setupIntro() {
        // Setup Intro Video
        const introTexture = Assets.get('introVideo');
        const introSource = introTexture.source.resource; 
        
        if (introSource && introSource.tagName === 'VIDEO') {
            introSource.muted = false; // Audio ON by default
            introSource.loop = false;
            introSource.playsInline = true;
        }

        this.introVideoSprite = new Sprite(introTexture);
        this.introVideoSprite.anchor.set(0.5);
        this.container.addChild(this.introVideoSprite);
        
        // Add Frame for Intro Video
        this.introFrame = new Graphics();
        this.container.addChild(this.introFrame);
        
        // Show HTML Mute Button
        if ((window as any).showMuteButton) {
            (window as any).showMuteButton(true);
            // Sync state
            (window as any).setMuteState(this.isMuted);
        }

        this.resizeSprite(this.introVideoSprite, true, true); // true = isVideo, true = limit

        // Setup Loop Video (Hidden)
        const loopTexture = Assets.get('loopVideo');
        const loopSource = loopTexture.source.resource;
        
        if (loopSource && loopSource.tagName === 'VIDEO') {
            loopSource.loop = true;
            loopSource.muted = true; // Loop is bg, keep muted? Or maybe user wants audio? Usually bg loops are muted.
            loopSource.playsInline = true;
        }

        this.loopVideoSprite = new Sprite(loopTexture);
        this.loopVideoSprite.anchor.set(0.5);
        this.loopVideoSprite.alpha = 0;
        this.container.addChild(this.loopVideoSprite);
        this.resizeSprite(this.loopVideoSprite, true);

        // Setup Start Button (Hidden)
        const btnTexture = Assets.get('startButton');
        this.startButton = new Sprite(btnTexture);
        this.startButton.anchor.set(0.5);
        this.startButton.alpha = 0;
        this.startButton.eventMode = 'static';
        this.startButton.cursor = 'pointer';
        this.startButton.on('pointerdown', () => {
            if ((window as any).playAudioEvent) (window as any).playAudioEvent('start_button_click');
            this.showCharacterSelection();
        });
        this.container.addChild(this.startButton);
        
        // Ensure everything is positioned correctly (especially the mute button)
        this.resize();

        // Play Intro
        if (introSource && introSource.tagName === 'VIDEO') {
            try {
                introSource.pause();
                introSource.currentTime = 0;
            } catch (e) {
                console.warn("Could not reset video time", e);
            }
            
            const playPromise = introSource.play();
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    // Video started successfully unmuted
                }).catch((e: any) => {
                    console.warn("Autoplay blocked unmuted, trying to play anyway (browser might block)", e);
                    
                    const startOnInteraction = () => {
                        introSource.play();
                        this.container.off('pointerdown', startOnInteraction);
                    };
                    this.container.eventMode = 'static';
                    this.container.on('pointerdown', startOnInteraction);
                });
            }

            introSource.addEventListener('ended', () => {
                if ((window as any).playAudioEvent) (window as any).playAudioEvent('intro_end');
                this.transitionToLoop();
            });
        } else {
            this.transitionToLoop();
        }
    }

    transitionToLoop() {
        if (!this.loopVideoSprite || !this.introVideoSprite) return;

        // Hide mute button and frame
        if ((window as any).showMuteButton) {
            (window as any).showMuteButton(false);
        }
        if (this.introFrame) {
            gsap.to(this.introFrame, { alpha: 0, duration: 0.5 });
        }

        const loopSource = this.loopVideoSprite.texture.source.resource;
        if (loopSource && loopSource.tagName === 'VIDEO') {
            loopSource.play().catch((e: any) => console.error("Loop play failed", e));
        }

        // Crossfade
        gsap.to(this.introVideoSprite, { alpha: 0, duration: 1 });
        gsap.to(this.loopVideoSprite, { alpha: 1, duration: 1 });

        // Show Button
        if (this.startButton) {
            gsap.to(this.startButton, { alpha: 1, duration: 1, delay: 0.5 });
            // Add a pulse effect to the button
            gsap.to(this.startButton.scale, { 
                x: this.startButton.scale.x * 1.05, 
                y: this.startButton.scale.y * 1.05, 
                duration: 0.8, 
                yoyo: true, 
                repeat: -1, 
                ease: "sine.inOut" 
            });
        }
    }

    showCharacterSelection() {
        // Hide Start Button immediately
        if (this.startButton) {
            this.startButton.visible = false;
        }

        const selectionScreen = document.getElementById('character-selection');
        if (selectionScreen) {
            selectionScreen.style.display = 'flex';
            
            // Animate entrance
            gsap.fromTo(selectionScreen, { opacity: 0 }, { opacity: 1, duration: 0.5 });
            
            const selectBtn = document.getElementById('cs-select-btn');
            if (selectBtn) {
                // Remove old listeners to prevent duplicates if called multiple times
                const newBtn = selectBtn.cloneNode(true);
                selectBtn.parentNode?.replaceChild(newBtn, selectBtn);
                
                newBtn.addEventListener('click', () => {
                    if ((window as any).playAudioEvent) (window as any).playAudioEvent('character_select');
                    gsap.to(selectionScreen, { 
                        opacity: 0, 
                        duration: 0.5, 
                        onComplete: () => {
                            selectionScreen.style.display = 'none';
                            this.startGame();
                        }
                    });
                });
            }
        } else {
            // Fallback if HTML is missing
            this.startGame();
        }
    }

    startGame() {
        if ((window as any).playAudioEvent) (window as any).playAudioEvent('game_start');
        // Disable button
        if (this.startButton) this.startButton.eventMode = 'none';

        // Show Supercell HUD
        if ((window as any).showHUD) (window as any).showHUD(true);

        // Force hide all HTML UI elements
        if ((window as any).showLoader) (window as any).showLoader(false);
        if ((window as any).showMuteButton) (window as any).showMuteButton(false);

        // Fade out container
        gsap.to(this.container, { alpha: 0, duration: 0.5, onComplete: () => {
            // Stop videos
            const introSource = this.introVideoSprite?.texture.source.resource;
            if (introSource && introSource.tagName === 'VIDEO') introSource.pause();
            
            const loopSource = this.loopVideoSprite?.texture.source.resource;
            if (loopSource && loopSource.tagName === 'VIDEO') loopSource.pause();

            this.onComplete();
        }});
    }

    resizeSprite(sprite: Sprite, isVideo: boolean = false, limitResolution: boolean = false) {
        if (!sprite || !sprite.texture) return;
        
        sprite.x = this.app.screen.width / 2;
        sprite.y = this.app.screen.height / 2;
        
        const screenWidth = this.app.screen.width;
        const screenHeight = this.app.screen.height;
        const texWidth = sprite.texture.width;
        const texHeight = sprite.texture.height;

        let scale = 1;

        // Cover logic
        const screenRatio = screenWidth / screenHeight;
        const spriteRatio = texWidth / texHeight;
        
        if (screenRatio > spriteRatio) {
            scale = screenWidth / texWidth;
        } else {
            scale = screenHeight / texHeight;
        }

        // Limit resolution logic (only if requested)
        if (limitResolution) {
            // If scale * texHeight > 1080, we clamp it.
            if (scale * texHeight > 1080) {
                scale = 1080 / texHeight;
            }
        }
        
        sprite.scale.set(scale);
    }

    resizeButton() {
        if (!this.startButton) return;
        
        this.startButton.x = this.app.screen.width / 2;
        this.startButton.y = this.app.screen.height * 0.85;
        
        // Responsive button size
        const targetWidth = Math.min(300, this.app.screen.width * 0.6);
        const scale = targetWidth / this.startButton.texture.width;
        this.startButton.scale.set(scale);
    }

    resize() {
        // Mobile Check
        const isMobile = this.app.screen.width < 768;

        if (this.background) {
            if (isMobile) {
                 // Mobile: 90vh height, maintain aspect ratio
                 const targetHeight = this.app.screen.height * 0.9;
                 const scale = targetHeight / this.background.texture.height;
                 this.background.scale.set(scale);
                 this.background.x = this.app.screen.width / 2;
                 this.background.y = this.app.screen.height / 2;
            } else {
                this.resizeSprite(this.background);
            }
        }

        if (this.introVideoSprite) {
            if (isMobile) {
                // Mobile: 90vh height, maintain aspect ratio
                const targetHeight = this.app.screen.height * 0.9;
                const scale = targetHeight / this.introVideoSprite.texture.height;
                this.introVideoSprite.scale.set(scale);
                this.introVideoSprite.x = this.app.screen.width / 2;
                this.introVideoSprite.y = this.app.screen.height / 2;
            } else {
                this.resizeSprite(this.introVideoSprite, true, true); // Desktop: Cover/Limit
            }
            
            // Update Frame
            if (this.introFrame) {
                this.introFrame.clear();
                const w = this.introVideoSprite.width;
                const h = this.introVideoSprite.height;
                // Draw border
                this.introFrame.rect(
                    this.introVideoSprite.x - w/2, 
                    this.introVideoSprite.y - h/2, 
                    w, h
                );
                this.introFrame.stroke({ width: 10, color: 0xffd700 }); // Gold border
                // Shadow
                this.introFrame.rect(
                    this.introVideoSprite.x - w/2 - 5, 
                    this.introVideoSprite.y - h/2 - 5, 
                    w + 10, h + 10
                );
                this.introFrame.stroke({ width: 2, color: 0x000000, alpha: 0.5 });
            }
        }
        if (this.loopVideoSprite) this.resizeSprite(this.loopVideoSprite, true, false); // Full resolution for loop
        if (this.startButton) this.resizeButton();
        
        if (this.logoSprite) {
            // Keep logo at reasonable size
            const maxLogoWidth = Math.min(600, this.app.screen.width * 0.8);
            const baseScale = maxLogoWidth / this.logoSprite.texture.width;
            this.logoSprite.scale.set(baseScale * this.logoScaleMultiplier);
            this.logoSprite.x = this.app.screen.width / 2;
            this.logoSprite.y = this.app.screen.height / 2;
        }

        if (this.clickToStartText) {
            this.clickToStartText.x = this.app.screen.width / 2;
            this.clickToStartText.y = this.app.screen.height - 100; // Bottom of the game
            
            // Responsive font size
            const targetWidth = this.app.screen.width * 0.8;
            if (this.clickToStartText.width > 0 && this.clickToStartText.width > targetWidth) {
                this.clickToStartText.scale.set(targetWidth / this.clickToStartText.width);
            } else {
                this.clickToStartText.scale.set(1);
            }
        }

        // Update HTML Mute Button Position
        if ((window as any).updateMuteButtonPosition) {
            const isDesktop = this.app.screen.width > 768;
            if (isDesktop && this.introVideoSprite) {
                // Position below video
                const videoBottom = this.introVideoSprite.y + (this.introVideoSprite.height / 2);
                (window as any).updateMuteButtonPosition(
                    this.app.screen.width / 2, 
                    videoBottom + 80, // 80px below video
                    true
                );
            } else {
                (window as any).updateMuteButtonPosition(0, 0, false);
            }
        }
    }
}
