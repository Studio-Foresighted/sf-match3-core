export const TileType = {
    RED: 0,
    BLUE: 1,
    GREEN: 2,
    YELLOW: 3,
    PURPLE: 4,
    ORANGE: 5,
    SPECIAL_STRIPED_H: 6,
    SPECIAL_STRIPED_V: 7,
    SPECIAL_BOMB: 8,
    SPECIAL_WRAPPED: 9,
    SPECIAL_COLOR_BOMB: 10
} as const;

export type TileType = typeof TileType[keyof typeof TileType];

export interface TileData {
    id: number;
    type: TileType;
    x: number;
    y: number;
}

export interface MatchResult {
    tiles: TileData[];
    specialToCreate: TileType | null;
    originX: number;
    originY: number;
}

export class Board {
    public grid: (TileData | null)[][];
    public width: number;
    public height: number;
    private nextId: number = 0;
    private lastSwap: { x1: number, y1: number, x2: number, y2: number } | null = null;

    constructor(width: number = 8, height: number = 8) {
        this.width = width;
        this.height = height;
        this.grid = Array.from({ length: height }, () => Array(width).fill(null));
    }

    setup() {
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                this.grid[y][x] = this.createRandomTile(x, y);
            }
        }
        // Ensure no initial matches
        this.resolveInitialMatches();
    }

    reshuffle() {
        // Collect all current tiles
        const allTiles: TileData[] = [];
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const t = this.grid[y][x];
                if (t) allTiles.push(t);
            }
        }

        let validConfig = false;
        let attempts = 0;
        
        while (!validConfig && attempts < 100) {
            attempts++;
            
            // Fisher-Yates shuffle of the OBJECTS (not just types)
            for (let i = allTiles.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [allTiles[i], allTiles[j]] = [allTiles[j], allTiles[i]];
            }

            // Place back into grid to check matches
            let idx = 0;
            for (let y = 0; y < this.height; y++) {
                for (let x = 0; x < this.width; x++) {
                    this.grid[y][x] = allTiles[idx++];
                }
            }

            // Check matches
            const matches = this.findMatches();
            if (matches.length === 0) {
                validConfig = true;
                // Commit x/y coordinates
                for (let y = 0; y < this.height; y++) {
                    for (let x = 0; x < this.width; x++) {
                        const t = this.grid[y][x];
                        if (t) {
                            t.x = x;
                            t.y = y;
                        }
                    }
                }
            }
        }
    }

    createRandomTile(x: number, y: number): TileData {
        const types = [TileType.RED, TileType.BLUE, TileType.GREEN, TileType.YELLOW, TileType.PURPLE, TileType.ORANGE];
        return {
            id: this.nextId++,
            type: types[Math.floor(Math.random() * types.length)],
            x,
            y
        };
    }

    private resolveInitialMatches() {
        let hasMatches = true;
        while (hasMatches) {
            hasMatches = false;
            const matches = this.findMatches();
            if (matches.length > 0) {
                hasMatches = true;
                for (const match of matches) {
                    for (const tile of match.tiles) {
                        this.grid[tile.y][tile.x] = this.createRandomTile(tile.x, tile.y);
                    }
                }
            }
        }
    }

    findMatches(): MatchResult[] {
        const horizontalMatches: { tiles: TileData[], x: number, y: number, len: number }[] = [];
        const verticalMatches: { tiles: TileData[], x: number, y: number, len: number }[] = [];

        // 1. Find all horizontal segments
        for (let y = 0; y < this.height; y++) {
            let count = 1;
            for (let x = 1; x <= this.width; x++) {
                if (x < this.width && this.grid[y][x] && this.grid[y][x-1] && 
                    this.grid[y][x]!.type === this.grid[y][x-1]!.type &&
                    this.grid[y][x]!.type < TileType.SPECIAL_STRIPED_H) { // Only match basic colors
                    count++;
                } else {
                    if (count >= 3) {
                        const segment = [];
                        for (let i = 0; i < count; i++) segment.push(this.grid[y][x - 1 - i]!);
                        horizontalMatches.push({ tiles: segment, x: x - count, y, len: count });
                    }
                    count = 1;
                }
            }
        }

        // 2. Find all vertical segments
        for (let x = 0; x < this.width; x++) {
            let count = 1;
            for (let y = 1; y <= this.height; y++) {
                if (y < this.height && this.grid[y][x] && this.grid[y-1][x] && 
                    this.grid[y][x]!.type === this.grid[y-1][x]!.type &&
                    this.grid[y][x]!.type < TileType.SPECIAL_STRIPED_H) {
                    count++;
                } else {
                    if (count >= 3) {
                        const segment = [];
                        for (let i = 0; i < count; i++) segment.push(this.grid[y - 1 - i][x]!);
                        verticalMatches.push({ tiles: segment, x, y: y - count, len: count });
                    }
                    count = 1;
                }
            }
        }

        const results: MatchResult[] = [];
        const usedHorizontal = new Set<number>();
        const usedVertical = new Set<number>();

        // 3. Identify Shapes (Intersections)
        for (let i = 0; i < horizontalMatches.length; i++) {
            for (let j = 0; j < verticalMatches.length; j++) {
                const h = horizontalMatches[i];
                const v = verticalMatches[j];

                // Check if they share a cell and have the same type
                if (h.tiles[0].type === v.tiles[0].type) {
                    const intersection = h.tiles.find(ht => v.tiles.some(vt => vt.x === ht.x && vt.y === ht.y));
                    
                    if (intersection) {
                        usedHorizontal.add(i);
                        usedVertical.add(j);

                        const combinedTiles = Array.from(new Set([...h.tiles, ...v.tiles]));
                        let special: TileType = TileType.SPECIAL_BOMB;
                        
                        // Crossed 4 (one segment is length 4)
                        if (h.len >= 4 || v.len >= 4) {
                            special = TileType.SPECIAL_WRAPPED;
                        }

                        // Origin: Prefer the moved tile if it's in the match
                        let originX = intersection.x;
                        let originY = intersection.y;
                        if (this.lastSwap) {
                            if (combinedTiles.some(t => t.x === this.lastSwap!.x1 && t.y === this.lastSwap!.y1)) {
                                originX = this.lastSwap!.x1; originY = this.lastSwap!.y1;
                            } else if (combinedTiles.some(t => t.x === this.lastSwap!.x2 && t.y === this.lastSwap!.y2)) {
                                originX = this.lastSwap!.x2; originY = this.lastSwap!.y2;
                            }
                        }

                        results.push({
                            tiles: combinedTiles,
                            specialToCreate: special,
                            originX,
                            originY
                        });
                    }
                }
            }
        }

        // 4. Handle remaining Straight matches
        horizontalMatches.forEach((h, idx) => {
            if (usedHorizontal.has(idx)) return;
            
            let special: TileType | null = null;
            if (h.len === 4) special = TileType.SPECIAL_STRIPED_H;
            else if (h.len >= 5) special = TileType.SPECIAL_COLOR_BOMB;

            let originX = h.tiles[Math.floor(h.len/2)].x;
            let originY = h.y;
            if (this.lastSwap) {
                const swapped = h.tiles.find(t => (t.x === this.lastSwap!.x1 && t.y === this.lastSwap!.y1) || (t.x === this.lastSwap!.x2 && t.y === this.lastSwap!.y2));
                if (swapped) { originX = swapped.x; originY = swapped.y; }
            }

            results.push({ tiles: h.tiles, specialToCreate: special, originX, originY });
        });

        verticalMatches.forEach((v, idx) => {
            if (usedVertical.has(idx)) return;

            let special: TileType | null = null;
            if (v.len === 4) special = TileType.SPECIAL_STRIPED_V;
            else if (v.len >= 5) special = TileType.SPECIAL_COLOR_BOMB;

            let originX = v.x;
            let originY = v.tiles[Math.floor(v.len/2)].y;
            if (this.lastSwap) {
                const swapped = v.tiles.find(t => (t.x === this.lastSwap!.x1 && t.y === this.lastSwap!.y1) || (t.x === this.lastSwap!.x2 && t.y === this.lastSwap!.y2));
                if (swapped) { originX = swapped.x; originY = swapped.y; }
            }

            results.push({ tiles: v.tiles, specialToCreate: special, originX, originY });
        });

        return results;
    }

    swap(x1: number, y1: number, x2: number, y2: number) {
        this.lastSwap = { x1, y1, x2, y2 };
        const temp = this.grid[y1][x1];
        this.grid[y1][x1] = this.grid[y2][x2];
        this.grid[y2][x2] = temp;

        if (this.grid[y1][x1]) {
            this.grid[y1][x1]!.x = x1;
            this.grid[y1][x1]!.y = y1;
        }
        if (this.grid[y2][x2]) {
            this.grid[y2][x2]!.x = x2;
            this.grid[y2][x2]!.y = y2;
        }
    }

    getTile(x: number, y: number): TileData | null {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return null;
        return this.grid[y][x];
    }
}

