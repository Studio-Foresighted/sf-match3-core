import Phaser from 'phaser';
import Match3Scene from './scenes/Match3Scene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 600,
  height: 800,
  parent: 'game-container',
  backgroundColor: '#333333',
  physics: {
    default: 'matter',
    matter: {
      gravity: { x: 0, y: 1 },
      debug: false
    }
  },
  scene: [Match3Scene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  }
};

new Phaser.Game(config);
