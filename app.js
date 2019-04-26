// that's like as close as you can get to Enums in plain Javascript nowadays
const STATE = Object.freeze({
  welcome: Symbol('welcome'),
  game: Symbol('game'),
  pause: Symbol('pause'),
  highscore: Symbol('highscore')
})

const STATE_TRANSITION = Object.freeze({
  [STATE.welcome]: STATE.game,
  [STATE.game]: STATE.pause,
  [STATE.pause]: STATE.game,
  [STATE.highscore]: STATE.welcome
})

const KEYMAP = Object.freeze({
  w: 'up',
  a: 'left',
  s: 'down',
  d: 'right',
  ArrowUp: 'up',
  ArrowLeft: 'left',
  ArrowDown: 'down',
  ArrowRight: 'right',
  Enter: 'fire',
  ' ': 'fire'
})

class Game {
  constructor (canvas, width = 960, height = 540) {
    this.canvas = canvas
    this.width = canvas.width = width
    this.height = canvas.height = height
    this.centerX = width / 2.0
    this.centerY = height / 2.0
    this.ctx = canvas.getContext('2d')

    this.state = STATE.welcome
    this.lastDraw = Date.now()
    this.frameCount = 0
    this.fps = 0
    this.hitCount = 0
    this.init()
  }

  fill (color, x, y, w, h) {
    this.ctx.fillStyle = color
    this.ctx.fillRect(x, y, w, h)
  }

  text (text, x, y, color = 'white') {
    this.ctx.fillStyle = color
    this.ctx.fillText(text, x, y)
  }

  initBackground () {
    this.lowerBGShiftX = 15 // (upperBGSize - lowerBGSize) + (upperBGSize - lowerBGSize) / 2
    this.lowerBGShiftY = 0
    this.lowerBGColor = '#111111'
    this.lowerBGSpeed = 2
    this.lowerBGSize = 40
    this.lowerBGSizeDoubled = this.lowerBGSize * 2

    this.upperBGShiftX = 0
    this.upperBGShiftY = 0
    this.upperBGColor = '#1a1a1a'
    this.upperBGSpeed = 3
    this.upperBGSize = 50
    this.upperBGSizeDoubled = this.upperBGSize * 2
  }

  initPlayer () {
    this.playerSize = 20
    this.playerX = this.centerX - 10
    this.playerY = this.centerY - 10
    this.playerMaxVelocity = 7
    this.playerVelocityX = 0
    this.playerVelocityY = 0
    this.playerAccelerationX = 0
    this.playerAccelerationY = 0
    this.playerFiring = false
    // this.playerMaxBullets = 20 // max bullets, could be used for burst shooting
    this.playerBulletVelocity = 10
    this.playerReloadTime = 100 // milliseconds until next bullet gets fired
    this.lastPlayerShot = 0
    this.playerBullets = []
  }

  initEnemies() {
    this.lastEnemyInsertion = 0
    this.enemyInsertionSpeed = 1000 // milliseconds until next enemy
    this.enemyVelocityX = 5
    this.enemyVelocityY = 0 // lets keep it simple: only side movement for now
    this.enemyStrength = 4 // hitpoints
    this.enemySizeMultiplicator = 5 // size = hitpoints * sizeMultiplicator
    this.maxEnemies = 4
    this.enemies = []
    this.enemyBullets = []
    this.enemyBulletVelocity = 10
    this.enemyReloadTime = 100 // milliseconds until next bullet gets fired
    this.lastEnemyShot = 0
}

  accelerate (direction) {
    switch (direction) {
    case 'up':
      this.playerAccelerationY = -1
      break
    case 'left':
      this.playerAccelerationX = -1
      break
    case 'down':
      this.playerAccelerationY = 1
      break
    case 'right':
      this.playerAccelerationX = 1
      break
    }
  }

  decelerate (direction) {
    switch (direction) {
    case 'up':
    case 'down':
      this.playerAccelerationY = 0
      break
    case 'left':
    case 'right':
      this.playerAccelerationX = 0
      break
    }
  }

  openFire () {
    console.log('OPEN FIRE!')
    this.playerFiring = true
  }

  ceaseFire () {
    console.log('HOLD FIRE!')
    this.playerFiring = false
  }

  attachEventListeners () {
    document.onkeydown = ({ key }) => {
      const action = KEYMAP[key]

      if (action === 'fire') this.openFire()
      else this.accelerate(action)
    }
    document.onkeyup = ({ key }) => {
      const action = KEYMAP[key]

      if (action === 'fire') this.ceaseFire()
      else this.decelerate(action)
    }
    this.canvas.onclick = () => {
      this.state = STATE_TRANSITION[this.state]
      console.log(this.state)
    }
  }

  init () {
    this.ctx.font = '16px monospace'
    this.attachEventListeners()

    this.initBackground()
    this.initPlayer()
    this.initEnemies()

    this.update()
  }

  reset () {
    this.fill('black', 0, 0, this.width, this.height)
  }

  drawBackground () {
    const pX = this.playerX
    const pY = this.playerY

    this.lowerBGShiftY = (this.lowerBGShiftY + this.lowerBGSpeed) % this.lowerBGSizeDoubled
    this.upperBGShiftY = (this.upperBGShiftY + this.upperBGSpeed) % this.upperBGSizeDoubled

    let y = this.lowerBGShiftY - this.lowerBGSizeDoubled + pY * -.05
    for (; y < this.height; y += this.lowerBGSizeDoubled) {

      let x = this.lowerBGShiftX + pX * -.1
      for (; x < this.width; x += this.lowerBGSizeDoubled) {
        this.fill(this.lowerBGColor, x, y, this.lowerBGSize, this.lowerBGSize)
      }
    }

    y = this.upperBGShiftY - this.upperBGSizeDoubled + pY * -.1
    for (; y < this.height; y += this.upperBGSizeDoubled) {

      let x = this.upperBGShiftX + pX * -.2
      for (; x < this.width; x += this.upperBGSizeDoubled) {
        this.fill(this.upperBGColor, x, y, this.upperBGSize, this.upperBGSize)
      }
    }
  }

  drawPlayer () {
    const aX = this.playerAccelerationX
    const aY = this.playerAccelerationY
    const vX = this.playerVelocityX
    const vY = this.playerVelocityY
    const pX = this.playerX
    const pY = this.playerY

    if (aX && Math.abs(vX) < this.playerMaxVelocity) {
      this.playerVelocityX += aX
    } else if (aX === 0 && vX !== 0) {
      this.playerVelocityX -= vX > 0 ? 1 : -1
    }
    if (aY && Math.abs(vY) < this.playerMaxVelocity) {
      this.playerVelocityY += aY
    } else if (aY === 0 && vY !== 0) {
      this.playerVelocityY -= vY > 0 ? 1 : -1
    }

    if ((vX < 0 && pX > 0) || (vX > 0 && pX < this.width)) this.playerX += vX
    if ((vY < 0 && pY > 0) || (vY > 0 && pY < this.height)) this.playerY += vY

    this.fill(
      'gray',
      this.playerX - this.playerSize / 2.0,
      this.playerY - this.playerSize / 2.0,
      this.playerSize,
      this.playerSize
    )
  }

  drawPlayerBullets (now) {
    if (this.playerFiring && (now - this.lastPlayerShot) > this.playerReloadTime) {
      const x = this.playerX
      const y = this.playerY
      this.playerBullets.push({x, y})
      this.lastPlayerShot = now
    }

    const amount = this.playerBullets.length

    for (let i = 0; i < amount; i++) {
      const bullet = this.playerBullets[i]

      const outHorizontal = bullet.x < 0 || bullet.x > this.width
      const outVertical = bullet.y < 0 || bullet.y > this.height

      if (outHorizontal || outVertical) {
        this.playerBullets[i] = null // the list get cleaned in collision detection function
      } else {
        bullet.y -= this.playerBulletVelocity
        this.fill('yellow', bullet.x, bullet.y, 5, 5)

        // UPGRADE 1
        // this.fill('yellow', bullet.x - 5, bullet.y, 5, 5)
        // this.fill('yellow', bullet.x + 5, bullet.y, 5, 5)

        // UPGRADE 2
        // this.fill('yellow', bullet.x + 5 * (amount - i), bullet.y, 5, 5)
        // this.fill('yellow', bullet.x, bullet.y, 5, 5)
        // this.fill('yellow', bullet.x - 5 * (amount - i), bullet.y, 5, 5)

        // CRAZY UPGRADE
        // this.fill('yellow', bullet.x + 5 * i, bullet.y, 5, 5)
        // this.fill('yellow', bullet.x, bullet.y, 5, 5)
        // this.fill('yellow', bullet.x - 5 * i, bullet.y, 5, 5)
      }
    }

  }

  drawEnemies (now) {
    let amount = this.enemies.length

    if (amount < this.maxEnemies && (now - this.lastEnemyInsertion) > this.enemyInsertionSpeed) {
      const fromLeft = !!(amount % 2)
      const x = fromLeft ? 0 : this.width
      this.enemies.push({x, y: 50, fromLeft, hp: this.enemyStrength})
      this.lastEnemyInsertion = now
      amount = this.enemies.length
    }

    const enemySize = this.enemySize

    for (let i = 0; i < amount; i++) {
      const enemy = this.enemies[i]
      const size = enemy.hp * this.enemySizeMultiplicator

      if (enemy.fromLeft) {
        if (enemy.x > this.width) enemy.fromLeft = false
        enemy.x += this.enemyVelocityX
      } else {
        if (enemy.x < 0) enemy.fromLeft = true
        enemy.x -= this.enemyVelocityX
      }

      this.fill('red', enemy.x, enemy.y, size, size)
    }
  }

  drawEnemyBullets (now) {
    if ((now - this.lastEnemyShot) > this.enemyReloadTime) {
      for (let i = 0; i < this.enemies.length; i++) {
        const enemy = this.enemies[i]
        const x = enemy.x
        const y = enemy.y
        this.enemyBullets.push({x, y})
      }
      this.lastEnemyShot = now
    }

    const amount = this.enemyBullets.length

    for (let i = 0; i < amount; i++) {
      const bullet = this.enemyBullets[i]

      const outHorizontal = bullet.x < 0 || bullet.x > this.width
      const outVertical = bullet.y < 0 || bullet.y > this.height

      if (outHorizontal || outVertical) {
        this.enemyBullets[i] = null // the list get cleaned in collision detection function
      } else {
        bullet.y += this.enemyBulletVelocity
        this.fill('red', bullet.x, bullet.y, 5, 5)
      }
    }
  }

  collisionDetection () {
    for (let i = 0; i < this.playerBullets.length; i++) {
      const bullet = this.playerBullets[i]
      if (bullet === null) continue

      for (let j = 0; j < this.enemies.length; j++) {
        const enemy = this.enemies[j]
        if (enemy === null) continue

        const size = enemy.hp * this.enemySizeMultiplicator
        const xDiff = Math.abs(enemy.x - bullet.x)
        const yDiff = Math.abs(enemy.y - bullet.y)

        if (xDiff <= size && yDiff <= size) {
          enemy.hp--
        }
        if (enemy.hp <= 0) {
          this.enemies[j] = null
          this.hitCount++
        }
      }
    }

    const pX = this.playerX
    const pY = this.playerY
    const size = this.playerSize

    for (let i = 0; i < this.enemyBullets.length; i++) {
      const bullet = this.enemyBullets[i]
      if (bullet === null) continue

      const xDiff = Math.abs(pX - bullet.x)
      const yDiff = Math.abs(pY - bullet.y)

      if (xDiff <= size && yDiff <= size) {
        this.playerSize -= 2
      }
    }

    // not sure if this is the most efficient way to filter them
    this.playerBullets = this.playerBullets.filter(bullet => bullet)
    this.enemyBullets = this.enemyBullets.filter(bullet => bullet)
    this.enemies = this.enemies.filter(enemy => enemy)
  }

  drawUI (now) {
    const delta = (now - this.lastDraw) / 1000
    if (this.frameCount % 10 === 0) this.fps = Math.ceil(1 / delta)
    this.text(`${this.fps} fps`, 10, 20)
    this.text(`${this.hitCount}`, this.width - 40, 20)
  }

  drawWelcome () {
    this.reset()
    this.text('Freddy vs JSON', this.centerX, this.centerY)
    this.text('click to start', this.centerX, this.centerY + 20)
  }

  drawHighscore () {
    this.reset()
    this.text('Congratulations! You died!', 10, this.centerY - 8)
    this.text(`(and took ${this.hitCount} enemies with you)`, 10, this.centerY + 8)
  }

  update () {
    requestAnimationFrame(() => this.update())
    if (this.state === STATE.welcome) {
      this.drawWelcome()
    } else if (this.state === STATE.highscore) {
      this.drawHighscore()
    } else {
      const now = Date.now()
      this.reset()
      this.drawBackground()
      this.drawPlayer()
      this.drawPlayerBullets(now)
      this.drawEnemies(now)
      this.drawEnemyBullets(now)
      this.collisionDetection()
      this.drawUI(now)
      this.frameCount++
      this.lastDraw = now

      // are we dead yet?
      if (this.playerSize <= 0) {
        this.initPlayer()
        this.state = STATE.highscore
      }
    }
  }
}
