// that's like as close as you can get to Enums in plain Javascript nowadays
// see https://en.wikipedia.org/wiki/Enumerated_type to learn about Enums
const STATE = Object.freeze({
  welcome: Symbol('welcome'),
  game: Symbol('game'),
  pause: Symbol('pause'),
  highscore: Symbol('highscore')
})

// defines possible transitions
const STATE_TRANSITION = Object.freeze({
  [STATE.welcome]: STATE.game,
  [STATE.game]: STATE.pause,
  [STATE.pause]: STATE.game,
  [STATE.highscore]: STATE.welcome
})

// maps keys to the respective commands
// used in click handler
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
    // initialize canvas
    this.canvas = canvas
    this.width = canvas.width = width
    this.height = canvas.height = height
    this.ctx = canvas.getContext('2d')

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

  // the background is made of two layers of boxes
  // that move in different speeds to create a parallax effect
  initBackground () {
    // (upperBGSize - lowerBGSize) + (upperBGSize - lowerBGSize) / 2
    this.lowerBGShiftX = 15       // shifts the boxes on x axis
    this.lowerBGShiftY = 0        // shifts the boxes on y axis
    this.lowerBGColor = '#111111'
    // general traverse speed to give the illusion of forward movement
    this.lowerBGSpeed = 2
    this.lowerBGSize = 40         // size of the drawn squares
    // used to determine the distance between the boxes
    this.lowerBGSizeDoubled = this.lowerBGSize * 2

    this.upperBGShiftX = 0
    this.upperBGShiftY = 0
    this.upperBGColor = '#1a1a1a'
    this.upperBGSpeed = 3
    this.upperBGSize = 50
    this.upperBGSizeDoubled = this.upperBGSize * 2
  }

  initPlayer () {
    // player size in pixels is also (twice) the health
    this.playerSize = 20
    this.playerX = this.centerX - 10 // initial position
    this.playerY = this.centerY - 10
    this.playerMaxVelocity = 7       // maximum speed in any direction
    this.playerVelocityX = 0         // used for current speed
    this.playerVelocityY = 0
    this.playerAccelerationX = 0     // sets the players movement direction
    this.playerAccelerationY = 0
    this.playerFiring = false
    this.playerBullets = []          // keeps track of all bullet positions
    this.playerBulletVelocity = 10   // how fast bullets move over the screen
    this.playerReloadTime = 100      // milliseconds until next bullet
    this.lastPlayerShot = 0          // used to calculate the firing rate
  }

  initEnemies() {
    this.lastEnemyInsertion = 0
    this.enemyInsertionSpeed = 1000  // milliseconds until next enemy
    this.maxEnemies = 4              // but not more than four at a time
    this.enemyVelocityX = 5          // lets keep it simple:
    this.enemyVelocityY = 0          // only side ways moving enemies
    this.enemyStrength = 4           // enemy hitpoints
    this.enemySizeMultiplicator = 5  // size = hitpoints * sizeMultiplicator
    this.enemies = []                // keeps track of all enemies
    this.enemyBullets = []           // keeps track of all enemy bullets
    this.enemyBulletVelocity = 10    // just like playerBulletVelocity
    this.enemyReloadTime = 100       // just like playerReloadTime
    this.lastEnemyShot = 0           // just like lastPlayerShot
  }

  // sets an acceleration value depending on the direction
  // it uses negative values for directions that move towards the
  // start of the coordinate system
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

  // cancels acceleration depending on the respective keyup event
  decelerate (direction) {
    switch (direction) {
    case 'up':
      if (this.playerAccelerationY < 0) this.playerAccelerationY = 0
      break
    case 'down':
      if (this.playerAccelerationY > 0) this.playerAccelerationY = 0
      break
    case 'left':
      if (this.playerAccelerationX < 0) this.playerAccelerationX = 0
      break
    case 'right':
      if (this.playerAccelerationX > 0) this.playerAccelerationX = 0
      break
    }
  }

  // this might not look like worth its own function
  // but it might become more complex and it is also
  // a good idea to keep the actual logic separated
  openFire () {
    this.playerFiring = true
  }

  ceaseFire () {
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
    // this font will be used for the HUD
    this.ctx.font = '16px monospace'

    // precalculate often used values
    this.centerX = width / 2.0
    this.centerY = height / 2.0

    // initialize game state and HUD
    this.state = STATE.welcome
    this.lastDraw = 0
    this.frameCount = 0
    this.fps = 0
    this.hitCount = 0

    this.attachEventListeners() // handle mouse and key events
    this.initBackground()       // set initial values for bg animation
    this.initPlayer()           // set initial values for player
    this.initEnemies()          // set initial values for enemies

    // this uses an arrow function to keep the function scope
    requestAnimationFrame(stamp => this.update(stamp))
  }

  reset () {
    // simply paints a black rectangle all over the canvas
    this.fill('black', 0, 0, this.width, this.height)
  }

  // this draws the background which gives an effect of steady movement
  drawBackground () {
    const pX = this.playerX
    const pY = this.playerY

    // The y-axis shift value moves the tiles down vertically for
    // twice a tile width (the space from one tile corner to the next)
    // and then jumps back to zero to create the illusion of endless
    // background tiles coming in from the top
    this.lowerBGShiftY = (this.lowerBGShiftY + this.lowerBGSpeed) % this.lowerBGSizeDoubled
    this.upperBGShiftY = (this.upperBGShiftY + this.upperBGSpeed) % this.upperBGSizeDoubled

    // start two tile sizes north of the screen plus the tile shift value
    // (remember: two tile sizes is the distance from one tile top to the next)
    // also add a small factor depending on the players y-axis position
    let y = this.lowerBGShiftY - this.lowerBGSizeDoubled + pY * -.05
    for (; y < this.height; y += this.lowerBGSizeDoubled) {

      // the impact of the players x-axis position is a bit larger
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

  // this function not only draws the player but
  // also calculates the ships position depending on the
  // current velocity
  // Unfortunately this is completely based on frame rate
  // and should be changed to be time based
  drawPlayer () {
    const aX = this.playerAccelerationX
    const aY = this.playerAccelerationY
    const vX = this.playerVelocityX
    const vY = this.playerVelocityY
    const pX = this.playerX
    const pY = this.playerY

    // as long as the player is not yet at full speed
    if (aX && Math.abs(vX) < this.playerMaxVelocity) {
      this.playerVelocityX += aX    // raise velocity
    // if the player is not accelerating but still moving
    } else if (aX === 0 && vX !== 0) {
      // add or substract until zero velocity
      this.playerVelocityX -= vX > 0 ? 1 : -1
    }
    if (aY && Math.abs(vY) < this.playerMaxVelocity) {
      this.playerVelocityY += aY
    } else if (aY === 0 && vY !== 0) {
      this.playerVelocityY -= vY > 0 ? 1 : -1
    }

    // this translates the velocity to coordinates but
    // checks that the player is still inside the screen
    if ((vX < 0 && pX > 0) || (vX > 0 && pX < this.width)) this.playerX += vX
    if ((vY < 0 && pY > 0) || (vY > 0 && pY < this.height)) this.playerY += vY

    // draw a little gray box a.k.a. the player
    this.fill(
      'gray',
      this.playerX - this.playerSize / 2.0,
      this.playerY - this.playerSize / 2.0,
      this.playerSize,
      this.playerSize
    )
  }

  // this function fills up the array of bullets,
  // sets their position and draws them
  drawPlayerBullets (now) {
    // the player fired since at least 100ms
    if (this.playerFiring && (now - this.lastPlayerShot) > this.playerReloadTime) {
      const x = this.playerX          // take player coordinates as origin
      const y = this.playerY
      this.playerBullets.push({x, y}) // and add a bullet at that position
      this.lastPlayerShot = now       // then reset the timer
    }

    const amount = this.playerBullets.length

    for (let i = 0; i < amount; i++) {
      const bullet = this.playerBullets[i]

      // check if bullet is outside of screen
      const outHorizontal = bullet.x < 0 || bullet.x > this.width
      const outVertical = bullet.y < 0 || bullet.y > this.height

      if (outHorizontal || outVertical) {
        // remove bullet from list (which gets cleaned after collisionDetection)
        this.playerBullets[i] = null
      } else {
        // otherwise move the bullet north according to its velocity
        bullet.y -= this.playerBulletVelocity
        // and finally draw it
        this.fill('yellow', bullet.x, bullet.y, 5, 5)

        // The following are proposed "weapon upgrades" that shoot multiple
        // bullets at a time. But the collision detection function would need
        // to be adapted too.
        // UPGRADE 1: two bullets
        // this.fill('yellow', bullet.x - 5, bullet.y, 5, 5)
        // this.fill('yellow', bullet.x + 5, bullet.y, 5, 5)

        // UPGRADE 2: original bullets and two bullets in v-shape
        // this.fill('yellow', bullet.x + 5 * (amount - i), bullet.y, 5, 5)
        // this.fill('yellow', bullet.x, bullet.y, 5, 5)
        // this.fill('yellow', bullet.x - 5 * (amount - i), bullet.y, 5, 5)

        // CRAZY UPGRADE: reverse v-shape
        // this.fill('yellow', bullet.x + 5 * i, bullet.y, 5, 5)
        // this.fill('yellow', bullet.x, bullet.y, 5, 5)
        // this.fill('yellow', bullet.x - 5 * i, bullet.y, 5, 5)
      }
    }

  }

  // this function inserts, moves and draws enemies
  // their movement is alternating on the x-axis
  drawEnemies (now) {
    let amount = this.enemies.length

    // add enemies as long (or as soon) as less than maxEnemies exist
    if (amount < this.maxEnemies && (now - this.lastEnemyInsertion) > this.enemyInsertionSpeed) {
      // alternating left or right sided entry
      const fromLeft = !!(amount % 2)
      const x = fromLeft ? 0 : this.width
      this.enemies.push({x, y: 50, fromLeft, hp: this.enemyStrength})
      this.lastEnemyInsertion = now
      amount = this.enemies.length
    }

    const enemySize = this.enemySize

    // draws all enemies. Their sizes depend on their health points
    // switch direction as soon as they reach the corner of the screen
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

  // pretty much the same as drawPlayerBullets
  // all enemy bullets simply move southwards from their origin
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
        this.enemyBullets[i] = null
      } else {
        bullet.y += this.enemyBulletVelocity
        this.fill('red', bullet.x, bullet.y, 5, 5)
      }
    }
  }

  // this function compares the positions
  // of each player bullet with enemies
  // and each enemy bullet with the player
  collisionDetection () {

    // checks for collisions of player bullets with enemies
    for (let i = 0; i < this.playerBullets.length; i++) {
      const bullet = this.playerBullets[i]
      if (bullet === null) continue

      for (let j = 0; j < this.enemies.length; j++) {
        const enemy = this.enemies[j]
        if (enemy === null) continue // enemy is already dead

        // the size of the enemy is its bounding box
        const size = enemy.hp * this.enemySizeMultiplicator
        const xDiff = Math.abs(enemy.x - bullet.x)
        const yDiff = Math.abs(enemy.y - bullet.y)

        // if the enemy got hit, remove one hp point
        if (xDiff <= size && yDiff <= size) {
          enemy.hp--
        }
        // if the enemy has no health, remove it from the list
        // and count the hit for the player
        if (enemy.hp <= 0) {
          this.enemies[j] = null
          this.hitCount++
        }
      }
    }

    const pX = this.playerX
    const pY = this.playerY
    const size = this.playerSize

    // check if enemy bullets hit the player
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
    // but only after all positions are checked, the lists are filtered
    this.playerBullets = this.playerBullets.filter(bullet => bullet)
    this.enemyBullets = this.enemyBullets.filter(bullet => bullet)
    this.enemies = this.enemies.filter(enemy => enemy)
  }

  // paints frames per second and points on the screen
  drawUI (now) {
    const delta = (now - this.lastDraw) / 1000
    // update fps only every tenth frame to make it less ghostly
    // TODO: maybe update this to use the average value of the last 10 frames
    if (this.frameCount % 10 === 0) this.fps = Math.ceil(1 / delta)
    this.text(`${this.fps} fps`, 10, 20)
    this.text(`${this.hitCount}`, this.width - 40, 20)
  }

  // the welcome screen
  drawWelcome () {
    this.reset()
    this.text('Freddy vs JSON', this.centerX, this.centerY)
    this.text('click to start', this.centerX, this.centerY + 20)
  }

  // the game over screen
  drawHighscore () {
    this.reset()
    this.text('Congratulations! You died!', 10, this.centerY - 8)
    this.text(`(and took ${this.hitCount} enemies with you)`, 10, this.centerY + 8)
  }

  // the central update loop
  update (stamp) {
    if (this.state === STATE.welcome) {
      this.drawWelcome()
    } else if (this.state === STATE.highscore) {
      this.drawHighscore()
    } else if (this.state === STATE.game) {
      this.reset()
      this.drawBackground()
      this.drawPlayer()
      this.drawPlayerBullets(stamp)
      this.drawEnemies(stamp)
      this.drawEnemyBullets(stamp)
      this.collisionDetection()
      this.drawUI(stamp)
      this.frameCount++
      this.lastDraw = stamp

      // Are we dead yet? Yes?
      // Then reset the players values and switch the game state
      if (this.playerSize <= 0) {
        this.initPlayer()
        this.state = STATE.highscore
      }
    }

    requestAnimationFrame(stamp => this.update(stamp))
  }
}
