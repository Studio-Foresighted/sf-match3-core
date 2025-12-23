import { Board, TileType, type TileData } from './Board.ts';

export interface MoveAnalysis {
    total: number;
    byType: Record<string, number>;
    byColor: Record<string, Record<string, number>>;
}

export class MoveFinder {
    private board: Board;

    constructor(board: Board) {
        this.board = board;
    }

    private getColorName(type: TileType): string {
        switch (type) {
            case TileType.RED: return 'Red';
            case TileType.BLUE: return 'Blue';
            case TileType.GREEN: return 'Green';
            case TileType.YELLOW: return 'Yellow';
            case TileType.PURPLE: return 'Purple';
            case TileType.ORANGE: return 'Orange';
            default: return 'Special';
        }
    }

    findAvailableMoves(): MoveAnalysis {
        const analysis: MoveAnalysis = {
            total: 0,
            byType: {
                '3x Match': 0,
                '4x Match': 0,
                '5x Match': 0,
                'L/T Shape': 0
            },
            byColor: {}
        };

        // Initialize colors
        ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange'].forEach(c => {
            analysis.byColor[c] = {
                '3x Match': 0,
                '4x Match': 0,
                '5x Match': 0,
                'L/T Shape': 0
            };
        });

        // Helper to check swap
        const checkSwap = (x1: number, y1: number, x2: number, y2: number) => {
            // Perform swap
            this.board.swap(x1, y1, x2, y2);
            
            const matches = this.board.findMatches();
            
            if (matches.length > 0) {
                analysis.total++;
                
                // Analyze best match in this move
                let bestType = '3x Match';
                let maxScore = 0;
                let primaryColor = 'Unknown';

                // Determine the primary color of the match
                if (matches[0].tiles.length > 0) {
                    primaryColor = this.getColorName(matches[0].tiles[0].type);
                }

                for (const match of matches) {
                    let score = 1;
                    let type = '3x Match';

                    if (match.specialToCreate === TileType.SPECIAL_COLOR_BOMB) {
                        type = '5x Match';
                        score = 4;
                    } else if (match.specialToCreate === TileType.SPECIAL_WRAPPED || match.specialToCreate === TileType.SPECIAL_BOMB) {
                        type = 'L/T Shape';
                        score = 3;
                    } else if (match.specialToCreate === TileType.SPECIAL_STRIPED_H || match.specialToCreate === TileType.SPECIAL_STRIPED_V) {
                        type = '4x Match';
                        score = 2;
                    }

                    if (score > maxScore) {
                        maxScore = score;
                        bestType = type;
                    }
                }
                
                analysis.byType[bestType]++;
                if (analysis.byColor[primaryColor]) {
                    analysis.byColor[primaryColor][bestType]++;
                }
            }

            // Revert swap
            this.board.swap(x1, y1, x2, y2);
        };

        for (let y = 0; y < this.board.height; y++) {
            for (let x = 0; x < this.board.width; x++) {
                // Check Right
                if (x < this.board.width - 1) {
                    checkSwap(x, y, x + 1, y);
                }
                // Check Down
                if (y < this.board.height - 1) {
                    checkSwap(x, y, x, y + 1);
                }
            }
        }

        return analysis;
    }

    getRandomMove(): { x1: number, y1: number, x2: number, y2: number, involvedTiles: TileData[], specialToCreate: TileType | null } | null {
        const moves: { x1: number, y1: number, x2: number, y2: number, involvedTiles: TileData[], specialToCreate: TileType | null }[] = [];

        const checkSwap = (x1: number, y1: number, x2: number, y2: number) => {
            this.board.swap(x1, y1, x2, y2);
            const matches = this.board.findMatches();
            if (matches.length > 0) {
                const involved = new Set<TileData>();
                let bestSpecial: TileType | null = null;
                
                // Add the two swapped tiles (now at new positions)
                const t1 = this.board.getTile(x1, y1);
                const t2 = this.board.getTile(x2, y2);
                if (t1) involved.add(t1);
                if (t2) involved.add(t2);

                // Add all matched tiles and check for specials
                for (const match of matches) {
                    for (const tile of match.tiles) {
                        involved.add(tile);
                    }
                    
                    // Prioritize specials: Color Bomb > Wrapped > Striped
                    if (match.specialToCreate !== null) {
                        if (bestSpecial === null) {
                            bestSpecial = match.specialToCreate;
                        } else if (match.specialToCreate === TileType.SPECIAL_COLOR_BOMB) {
                            bestSpecial = TileType.SPECIAL_COLOR_BOMB;
                        } else if (match.specialToCreate === TileType.SPECIAL_WRAPPED && bestSpecial !== TileType.SPECIAL_COLOR_BOMB) {
                            bestSpecial = TileType.SPECIAL_WRAPPED;
                        }
                    }
                }
                
                moves.push({ x1, y1, x2, y2, involvedTiles: Array.from(involved), specialToCreate: bestSpecial });
            }
            this.board.swap(x1, y1, x2, y2);
        };

        for (let y = 0; y < this.board.height; y++) {
            for (let x = 0; x < this.board.width; x++) {
                if (x < this.board.width - 1) checkSwap(x, y, x + 1, y);
                if (y < this.board.height - 1) checkSwap(x, y, x, y + 1);
            }
        }

        if (moves.length === 0) return null;
        return moves[Math.floor(Math.random() * moves.length)];
    }
}
