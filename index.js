const puppeteer = require('puppeteer');
const axios = require('axios');

const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1360832516512157809/V10qjRsiJm65ACKxPvJ_KkwmrfWBrlHGf4Fc-I-npVW7Md6Kq86RVqSfy8CkzeNSoYgI';
const IBL_URL = 'https://www.flashscore.in/basketball/indonesia/ibl/';
const BELARUS_URL = 'https://www.flashscore.in/basketball/belarus/premier-league-women/';

let previousStatuses = {};

async function sendDiscordMessage(content) {
  await axios.post(DISCORD_WEBHOOK_URL, { content }).catch(console.error);
}

async function scrapeGames(page, leagueName) {
  await page.goto(leagueName === 'IBL' ? IBL_URL : BELARUS_URL, { waitUntil: 'networkidle2' });
  await page.waitForSelector('.event__match', { timeout: 10000 });

  return await page.evaluate((leagueName) => {
    const games = [];
    const rows = document.querySelectorAll('.event__match.event__match--live');

    rows.forEach(row => {
      const homeTeam = row.querySelector('.event__participant--home')?.textContent.trim();
      const awayTeam = row.querySelector('.event__participant--away')?.textContent.trim();
      const redScore = row.querySelector('.event__scores span[event__score--leading]')?.textContent.trim() || row.querySelector('.event__scores')?.textContent.trim();
      const status = row.querySelector('.event__stage')?.textContent.trim();

      games.push({
        homeTeam,
        awayTeam,
        score: redScore,
        status,
        league: leagueName
      });
    });

    return games;
  }, leagueName);
}

function hasStatusChanged(game) {
  const key = `${game.league}_${game.homeTeam}_vs_${game.awayTeam}`;
  const prev = previousStatuses[key];
  if (prev !== game.status) {
    previousStatuses[key] = game.status;
    return true;
  }
  return false;
}

async function monitorGames() {
  console.log("🚀 Script started... watching IBL and Belarus Premier League Women live games...");
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();

  try {
    for (const league of ['IBL', 'Belarus']) {
      console.log(`🔍 Checking ${league} games...`);
      const games = await scrapeGames(page, league);

      for (const game of games) {
        if (hasStatusChanged(game)) {
          const msg = `🏀 [${game.league}] ${game.homeTeam} vs ${game.awayTeam} | Score: ${game.score || 'N/A'} | Status: ${game.status}`;
          console.log(`📣 Status Changed: ${msg}`);
          await sendDiscordMessage(msg);

          if (game.status.toLowerCase().includes("finished")) {
            console.log(`✅ Final update for ${game.homeTeam} vs ${game.awayTeam}`);
          }
        }
      }
    }
  } catch (err) {
    console.error("❌ Error:", err.message);
  } finally {
    await browser.close();
  }
}

setInterval(monitorGames, 60 * 1000); // every 1 minute
