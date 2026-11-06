import mineflayer from 'mineflayer';
import pkg from 'mineflayer-pathfinder';
const { pathfinder, Movements, goals } = pkg;
import http from 'http';

// Render web port keep-alive
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.write("Bot Active!");
  res.end();
}).listen(process.env.PORT || 8080);

function createBotInstance() {
  const bot = mineflayer.createBot({
    host: 'gravitymc2.mcsh.gg', 
    port: 25565,                  
    username: 'SenpaiSpider', 
    version: '1.21.4',
    auth: 'offline'
  });

  bot.loadPlugin(pathfinder);

  let targetPlayer = null;
  let isFighting = false;
  let movements = null;
  let lastAttackTick = 0;
  let lastPathUpdate = 0;

  // Anti-cheat bypass
  bot.on('login', () => {
    if (bot._client) {
      const origWrite = bot._client.write.bind(bot._client);
      bot._client.write = (name, packet) => {
        const result = origWrite(name, packet);
        if (name === 'position' || name === 'position_look' || name === 'look' || name === 'flying') {
          try { origWrite('tick_end', {}); } catch (err) {}
        }
        return result;
      };
    }
  });

  bot.on('spawn', () => {
    console.log("Bot joined the server successfully!");
    movements = new Movements(bot);
    movements.canDig = false; 
    bot.pathfinder.setMovements(movements);
    bot.chat('Hello! Type !startbot to start PvP.');
  });

  // Chat command handler (!startbot and !stopbot)
  bot.on('chat', (username, message) => {
    if (username === bot.username) return;

    const cleanMessage = message.trim().toLowerCase();

    if (cleanMessage === '!startbot') {
      const playerFilter = (entity) => entity.type === 'player' && entity.username !== bot.username;
      const targetEntity = bot.nearestEntity(playerFilter);

      if (targetEntity) {
        targetPlayer = targetEntity;
        isFighting = true;
        bot.chat(`Target locked: ${targetEntity.username || 'Player'}! Ashchi tomar kase!`);
        
        try {
          if (movements && targetPlayer.position) {
            bot.pathfinder.setGoal(new goals.GoalFollow(targetPlayer, 1.5), true);
          }
        } catch (e) {
          console.log("Pathfinder error:", e);
        }
      } else {
        bot.chat(`${username}, ami kauke dekhte pacchi na!`);
      }
    }

    if (cleanMessage === '!stopbot') {
      isFighting = false;
      targetPlayer = null;
      try {
        bot.pathfinder.setGoal(null);
        bot.clearControlStates();
      } catch (e) {}
      bot.chat('Bot stopped.');
    }
  });

  // PvP Combat & Following Loop with active path refreshing
  bot.on('physicsTick', () => {
    if (!isFighting || !targetPlayer) return;

    try {
      if (!targetPlayer.isValid || !bot.entities[targetPlayer.id] || targetPlayer.position.distanceTo(bot.entity.position) > 60) {
        bot.chat('Target lost or died. Stopping attack.');
        isFighting = false;
        targetPlayer = null;
        bot.pathfinder.setGoal(null);
        return;
      }

      const distance = bot.entity.position.distanceTo(targetPlayer.position);
      const currentTick = bot.time.age;

      if (distance <= 3.0) {
        // Within attack range: stop pathfinder movement, look at player and hit
        bot.pathfinder.setGoal(null);
        bot.lookAt(targetPlayer.position.offset(0, targetPlayer.height, 0));
        
        if (currentTick - lastAttackTick > 10) {
          bot.attack(targetPlayer);
          lastAttackTick = currentTick;
        }
      } else {
        // Out of attack range: refresh the follow goal every 15 ticks so it actively chases you
        if (currentTick - lastPathUpdate > 15 || bot.pathfinder.goal() === null) {
          bot.pathfinder.setGoal(new goals.GoalFollow(targetPlayer, 1.5), true);
          lastPathUpdate = currentTick;
        }
      }
    } catch (err) {
      // Prevent crash
    }
  });

  bot.on('end', (reason) => {
    console.log(`Disconnected (${reason}). Reconnecting in 5 seconds...`);
    setTimeout(() => createBotInstance(), 5000);
  });

  bot.on('error', (err) => console.log("Bot error:", err));
}

createBotInstance();
