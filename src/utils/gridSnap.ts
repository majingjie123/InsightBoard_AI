export interface Point {
  x: number;
  y: number;
}

export class GridSnapper {
  constructor(
    private gridSize: number = 20,
    private snapThreshold: number = 10
  ) {}

  snap(value: number): number {
    const remainder = value % this.gridSize;
    if (remainder < this.snapThreshold) {
      return value - remainder;
    }
    if (this.gridSize - remainder < this.snapThreshold) {
      return value + (this.gridSize - remainder);
    }
    return value;
  }

  snapPosition(pos: Point): Point {
    return {
      x: this.snap(pos.x),
      y: this.snap(pos.y)
    };
  }

  snapSize(size: { width: number; height: number }): { width: number; height: number } {
    return {
      width: Math.max(this.gridSize, this.snap(size.width)),
      height: Math.max(this.gridSize, this.snap(size.height))
    };
  }
}

export const gridSnapper = new GridSnapper(20, 10);
export default gridSnapper;
