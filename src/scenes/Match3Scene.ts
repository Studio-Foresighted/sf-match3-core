import Phaser from 'phaser';

export default class Match3Scene extends Phaser.Scene {
    private gridSize = 8;
    private tileSize = 60;
    private offsetX = 0;
    private offsetY = 150;
    private colors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff];
    private selectedTile: Phaser.GameObjects.Container | null = null;
    private score = 0;
    private scoreText!: Phaser.GameObjects.Text;
    private movesLeft = 20;
    private movesText!: Phaser.GameObjects.Text;
    private gameWidth = 600;
    private tiles: Phaser.GameObjects.Container[] = [];
    private particleTextureCreated = false;

    constructor() {
        super('Match3Scene');
    }

    create() {
        this.offsetX = (this.gameWidth - (this.gridSize * this.tileSize)) / 2;
        
        this.createUI();
        this.createWalls();
        this.spawnInitialTiles();
        
        this.input.on('pointerdown', this.handleInputStart, this);
        this.input.on('pointerup', this.handleInputEnd, this);
        
        // Periodic check for matches
        this.time.addEvent({ delay: 1000, callback: this.gameLoop, callbackScope: this, loop: true });
    }

    createUI() {
        this.scoreText = this.add.text(20, 20, 'Score: 0', { fontSize: '32px', color: '#fff' });
        this.movesText = this.add.text(400, 20, 'Moves: 20', { fontSize: '32px', color: '#fff' });
    }

    createWalls() {
        // Floor
        this.matter.add.rectangle(
            this.gameWidth / 2, 
            this.offsetY + this.gridSize * this.tileSize + 10, 
            this.gameWidth, 
            20, 
            { isStatic: true }
        );

        // Vertical walls between columns
        for (let i = 0; i <= this.gridSize; i++) {
            const x = this.offsetX + i * this.tileSize;
            const height = this.gridSize * this.tileSize * 4; // Tall enough
            this.matter.add.rectangle(
                x, 
                this.offsetY + this.gridSize * this.tileSize / 2 - height/2 + 500, 
                2, 
                height, 
                { isStatic: true, label: 'wall' }
            );
        }
    }

    spawnInitialTiles() {
        for (let col = 0; col < this.gridSize; col++) {
            for (let row = 0; row < this.gridSize; row++) {
                this.spawnTile(col, row * -1);
            }
        }
    }

    spawnTile(col: number, rowOffset: number) {
        const color = Phaser.Math.RND.pick(this.colors);
        const x = this.offsetX + col * this.tileSize + this.tileSize / 2;
        const y = this.offsetY + rowOffset * this.tileSize + this.tileSize / 2;

        const container = this.add.container(x, y);
        
        const graphics = this.add.graphics();
        graphics.fillStyle(color, 1);
        graphics.lineStyle(2, 0xffffff, 1);
        graphics.fillCircle(0, 0, this.tileSize / 2 - 4);
        graphics.strokeCircle(0, 0, this.tileSize / 2 - 4);
        
        container.add(graphics);
        container.setData('color', color);
        
        // Physics body - square for stacking stability
        const body = this.matter.add.rectangle(x, y, this.tileSize - 2, this.tileSize - 2, {
            friction: 0.5,
            restitution: 0.0,
            density: 0.001
        });
        
        this.matter.add.gameObject(container, body);
        this.tiles.push(container);
    }

    handleInputStart(pointer: Phaser.Input.Pointer) {
        if (this.movesLeft <= 0) return;
        
        // Find clicked tile
        const clickedTile = this.tiles.find(tile => {
            const body = tile.body as MatterJS.BodyType;
            if (!body) return false;
            return this.matter.containsPoint(body, pointer.x, pointer.y);
        });

        if (clickedTile) {
            this.selectedTile = clickedTile;
            const graphics = clickedTile.list[0] as Phaser.GameObjects.Graphics;
            graphics.alpha = 0.5;
        }
    }

    handleInputEnd(pointer: Phaser.Input.Pointer) {
        if (!this.selectedTile) return;

        const graphics = this.selectedTile.list[0] as Phaser.GameObjects.Graphics;
        graphics.alpha = 1;

        const dx = pointer.x - this.selectedTile.x;
        const dy = pointer.y - this.selectedTile.y;
        
        if (Math.abs(dx) > Math.abs(dy)) {
            if (Math.abs(dx) > 20) {
                this.attemptSwap(this.selectedTile, dx > 0 ? 1 : -1, 0);
            }
        } else {
            if (Math.abs(dy) > 20) {
                this.attemptSwap(this.selectedTile, 0, dy > 0 ? 1 : -1);
            }
        }
        
        this.selectedTile = null;
    }

    attemptSwap(tile: Phaser.GameObjects.Container, dirX: number, dirY: number) {
        const body = tile.body as MatterJS.BodyType;
        const targetX = body.position.x + dirX * this.tileSize;
        const targetY = body.position.y + dirY * this.tileSize;
        
        const neighbor = this.tiles.find(t => {
            const b = t.body as MatterJS.BodyType;
            return Math.abs(b.position.x - targetX) < this.tileSize/2 && Math.abs(b.position.y - targetY) < this.tileSize/2;
        });

        if (neighbor) {
            this.swapTiles(tile, neighbor);
        }
    }

    swapTiles(tile1: Phaser.GameObjects.Container, tile2: Phaser.GameObjects.Container) {
        this.movesLeft--;
        this.movesText.setText('Moves: ' + this.movesLeft);
        
        const body1 = tile1.body as MatterJS.BodyType;
        const body2 = tile2.body as MatterJS.BodyType;
        
        const pos1 = { x: body1.position.x, y: body1.position.y };
        const pos2 = { x: body2.position.x, y: body2.position.y };
        
        this.matter.body.setPosition(body1, pos2);
        this.matter.body.setPosition(body2, pos1);
        
        // Check matches after a moment
        this.time.delayedCall(500, () => {
            if (!this.checkMatches()) {
                // Swap back if no match
                this.matter.body.setPosition(body1, pos1);
                this.matter.body.setPosition(body2, pos2);
            }
        });
    }

    getGridState() {
        const grid: (Phaser.GameObjects.Container | null)[][] = Array(this.gridSize).fill(null).map(() => Array(this.gridSize).fill(null));
        
        this.tiles.forEach(tile => {
            if (!tile.active) return;
            const body = tile.body as MatterJS.BodyType;
            // Calculate grid position based on physical position
            const col = Math.round((body.position.x - this.offsetX - this.tileSize/2) / this.tileSize);
            const row = Math.round((body.position.y - this.offsetY - this.tileSize/2) / this.tileSize);
            
            if (col >= 0 && col < this.gridSize && row >= 0 && row < this.gridSize) {
                grid[row][col] = tile;
            }
        });
        return grid;
    }

    checkMatches() {
        const grid = this.getGridState();
        const matches = new Set<Phaser.GameObjects.Container>();
        
        // Horizontal
        for (let row = 0; row < this.gridSize; row++) {
            for (let col = 0; col < this.gridSize - 2; col++) {
                const t1 = grid[row][col];
                const t2 = grid[row][col+1];
                const t3 = grid[row][col+2];
                
                if (t1 && t2 && t3) {
                    const c1 = t1.getData('color');
                    const c2 = t2.getData('color');
                    const c3 = t3.getData('color');
                    if (c1 === c2 && c2 === c3) {
                        matches.add(t1);
                        matches.add(t2);
                        matches.add(t3);
                    }
                }
            }
        }
        
        // Vertical
        for (let col = 0; col < this.gridSize; col++) {
            for (let row = 0; row < this.gridSize - 2; row++) {
                const t1 = grid[row][col];
                const t2 = grid[row+1][col];
                const t3 = grid[row+2][col];
                
                if (t1 && t2 && t3) {
                    const c1 = t1.getData('color');
                    const c2 = t2.getData('color');
                    const c3 = t3.getData('color');
                    if (c1 === c2 && c2 === c3) {
                        matches.add(t1);
                        matches.add(t2);
                        matches.add(t3);
                    }
                }
            }
        }
        
        if (matches.size > 0) {
            this.processMatches(Array.from(matches));
            return true;
        }
        return false;
    }

    processMatches(matches: Phaser.GameObjects.Container[]) {
        this.score += matches.length * 10;
        this.scoreText.setText('Score: ' + this.score);
        
        this.createParticleTexture();
        
        matches.forEach(tile => {
            const emitter = this.add.particles(tile.x, tile.y, 'particle', {
                speed: { min: 50, max: 150 },
                scale: { start: 0.5, end: 0 },
                lifespan: 500,
                quantity: 10,
                emitting: false
            });
            emitter.explode(10);
            
            this.tiles = this.tiles.filter(t => t !== tile);
            tile.destroy();
        });
        
        this.time.delayedCall(500, () => this.refill());
    }
    
    createParticleTexture() {
        if (this.particleTextureCreated) return;
        if (this.textures.exists('particle')) return;
        
        const graphics = this.make.graphics({x:0, y:0});
        graphics.fillStyle(0xffffff);
        graphics.fillCircle(5,5,5);
        graphics.generateTexture('particle', 10, 10);
        this.particleTextureCreated = true;
    }

    refill() {
        const grid = this.getGridState();
        
        for (let col = 0; col < this.gridSize; col++) {
            let missing = 0;
            // Count missing from bottom up?
            // Actually we just need to know how many are missing in the column to spawn that many on top
            // But we also need to know if there are gaps in the middle?
            // Physics will handle the falling of existing ones.
            // We just need to spawn new ones at the top if the column is not full.
            
            // Count total tiles in this column
            let count = 0;
            for(let row=0; row<this.gridSize; row++) {
                if(grid[row][col]) count++;
            }
            
            const needed = this.gridSize - count;
            for (let i = 0; i < needed; i++) {
                this.spawnTile(col, -2 - i);
            }
        }
    }
    
    gameLoop() {
        if (this.movesLeft <= 0) {
            this.add.text(this.gameWidth/2, 300, 'GAME OVER', { fontSize: '64px', color: '#ff0000' }).setOrigin(0.5);
            this.scene.pause();
            return;
        }
        this.checkMatches();
    }
}
