// Node modules.
import _ from 'lodash';
import puppeteer from 'puppeteer';
import { parse } from 'node-html-parser';
import urlJoin from 'url-join';
import { sprintf } from 'sprintf-js';
import { Pokedex } from 'pmgo-pokedex';
// Local modules.
import { hostUrl } from './utils';
import tags from '../data/rocket-invasion-category-tags.json';
import descriptionDict from '../data/rocket-invasion-description-dictionary.json';

interface RocketInvasion {
  quote: string;
  orignialQuote: string;
  category: string;
  characterImageUrl: string;
  isSpecial: boolean;
  lineupPokemons: LineupPokemon[];
}

interface LineupPokemon {
  slotNo: number;
  no: number;
  name: string;
  originalName: string;
  types: string[];
  catchable: boolean;
  shinyAvailable: boolean;
  imageUrl: string;
}

const pokedex = new Pokedex();

const translateDescription = (description: string) => {
  const matchedRule = descriptionDict.find((rule) => (new RegExp(rule.pattern, 'i')).test(description));

  if (matchedRule) {
    const [, ...matches] = description.match(new RegExp(matchedRule.pattern, 'i'))!;
    return sprintf(matchedRule.displayText, ...matches);
  } else {
    return description;
  }
};

const categoryMapping = (categoryTag: string) => {
  const matchedTag = tags.find((tag) => tag.text === categoryTag);

  if (matchedTag) {
    return matchedTag.displayText;
  } else {
    return categoryTag;
  }
};

const characterImageUrlMapping = (characterName: string) => {
  const baseUrl = 'https://raw.githubusercontent.com/pmgo-professor-willow/data-pokemongohub/main/assets/';

  switch (characterName) {
    case 'Cliff':
      return urlJoin(baseUrl, '/leader-cliff.png');
    case 'Arlo':
      return urlJoin(baseUrl, '/leader-arlo.png');
    case 'Sierra':
      return urlJoin(baseUrl, '/leader-sierra.png');
    case 'Giovanni':
      return urlJoin(baseUrl, '/boss-giovanni.png');
    case 'James':
      return urlJoin(baseUrl, '/leader-james.png');
    case 'Jessie':
      return urlJoin(baseUrl, '/leader-jessie.png');
    case 'Male Grunt':
      return urlJoin(baseUrl, '/grunt-male.png');
    case 'Female Grunt':
      return urlJoin(baseUrl, '/grunt-female.png');
    default:
      return _.random(1)
        ? urlJoin(baseUrl, '/grunt-male.png')
        : urlJoin(baseUrl, '/grunt-female.png');
  }
};

const getGruntRocketInvasions = async () => {
  const rocketInvasionUrl = urlJoin(hostUrl, '/post/guide/team-go-rocket-battle-guide/');
  const browser = await puppeteer.launch({
    args: ['--no-sandbox'],
    executablePath: process.env.PUPPETEER_EXEC_PATH, // set by docker container
    headless: false,
  });
  const page = await browser.newPage();
  await page.goto(rocketInvasionUrl, { waitUntil: 'networkidle0' });

  // Scroll to the bottom of the page for downloading all the images.
  await page.evaluate(() => {
    return new Promise((resolve) => {
      const totalHeight = document.body.scrollHeight;
      const distance = 100;
      const delay = 30000 / (totalHeight / distance);

      let scrolled = 0;

      const timer = setInterval(() => {
        window.scrollBy(0, distance);
        scrolled += distance;

        if (scrolled >= totalHeight) {
          clearInterval(timer);
          resolve(true);
        }
      }, delay);
    });
  });

  const xml = await page.evaluate(() => document.querySelector('*')?.outerHTML!);
  await page.waitForTimeout(1000);
  await browser.close();

  const root = parse(xml);
  const rocketInvasionItems = root.querySelectorAll('.hub-title-with-icon');

  const rocketInvasions: RocketInvasion[] = [];
  
  for (const rocketInvasionItem of rocketInvasionItems) {
    const orignialQuote = rocketInvasionItem.rawText.trim() ?? '';
    const categoryRaw = rocketInvasionItem.parentNode.nextElementSibling.querySelector('span.type-badge')?.rawText.trim() ?? '';

    let characterName: 'Grunt' | 'Male Grunt' | 'Female Grunt' = 'Grunt';

    // Check this one is `h2` element
    const isMutipleLineups = rocketInvasionItem.parentNode.nextElementSibling.nextElementSibling.tagName === 'H2';

    if (!isMutipleLineups) {
      const lineupSlotItems = rocketInvasionItem.parentNode.nextElementSibling.nextElementSibling.querySelectorAll('table tr td');
      const lineupPokemons = lineupSlotItems.reduce<LineupPokemon[]>((all, lineupSlotItem, i) => {
        const lineupPokemonItems = lineupSlotItem.querySelectorAll('a');
  
        lineupPokemonItems.forEach((lineupPokemonItem, j) => {
          const originalName = lineupPokemonItem.querySelector('.content .name')?.rawText.trim() ?? '';
          const pokemon = pokedex.getPokemonByFuzzyName(originalName);
          const imageUrl = lineupPokemonItem.querySelector('img')?.getAttribute('src') ?? '';
          const shinyAvailable = lineupPokemonItem.classNames.includes('shiny');
  
          console.log(imageUrl);

          all.push({
            slotNo: i + 1,
            no: pokemon.no,
            // name: pokemon.form ? `${pokemon.name} (${pokemon.form})` : pokemon.name,
            name: pokemon.name,
            originalName: originalName,
            types: pokemon.types,
            catchable: false, // FIXME: not implemented yet.
            shinyAvailable,
            imageUrl,
          });
        });
  
        return all;
      }, []);

      rocketInvasions.push({
        quote: translateDescription(orignialQuote),
        orignialQuote,
        category: categoryMapping(categoryRaw),
        characterImageUrl: characterImageUrlMapping(characterName),
        isSpecial: false,
        lineupPokemons,
      });
    } else {
      const lineupSlotItems = rocketInvasionItem.parentNode.nextElementSibling.nextElementSibling.nextElementSibling.querySelectorAll('table tr td');
      const lineupPokemons = lineupSlotItems.reduce<LineupPokemon[]>((all, lineupSlotItem, i) => {
        const lineupPokemonItems = lineupSlotItem.querySelectorAll('a');
  
        lineupPokemonItems.forEach((lineupPokemonItem, j) => {
          const originalName = lineupPokemonItem.querySelector('.content .name')?.rawText.trim() ?? '';
          const pokemon = pokedex.getPokemonByFuzzyName(originalName);
          const imageUrl = lineupPokemonItem.querySelector('img')?.getAttribute('src') ?? '';
          const shinyAvailable = lineupPokemonItem.classNames.includes('shiny');
  
          all.push({
            slotNo: i + 1,
            no: pokemon.no,
            // name: pokemon.form ? `${pokemon.name} (${pokemon.form})` : pokemon.name,
            name: pokemon.name,
            originalName: originalName,
            types: pokemon.types,
            catchable: false, // FIXME: not implemented yet.
            shinyAvailable,
            imageUrl,
          });
        });
  
        return all;
      }, []);

      rocketInvasions.push({
        quote: translateDescription(orignialQuote),
        orignialQuote,
        category: categoryMapping(categoryRaw),
        characterImageUrl: characterImageUrlMapping(characterName),
        isSpecial: false,
        lineupPokemons,
      });

    }
  }

  const sortedRocketInvasions = _.orderBy(rocketInvasions, (rocketInvasion) => {
    const matchedTag = tags.find((tag) => tag.displayText === rocketInvasion.category);
    return matchedTag?.priority;
  }, ['asc']);

  return sortedRocketInvasions;
};

const getLeaderRocketInvasions = async (category: 'Leader' | 'Boss', leaderName: string) => {
  const rocketInvasionUrl = urlJoin(hostUrl, `/post/guide/rocket-${category.toLocaleLowerCase()}-${leaderName.toLocaleLowerCase()}-counters/`);
  const browser = await puppeteer.launch({
    args: ['--no-sandbox'],
    executablePath: process.env.PUPPETEER_EXEC_PATH, // set by docker container
    headless: false,
  });
  const page = await browser.newPage();
  await page.goto(rocketInvasionUrl, { waitUntil: 'networkidle0' });

  // Scroll to the bottom of the page for downloading all the images.
  await page.evaluate(() => {
    return new Promise((resolve) => {
      const totalHeight = document.body.scrollHeight;
      const distance = 100;
      const delay = 30000 / (totalHeight / distance);

      let scrolled = 0;

      const timer = setInterval(() => {
        window.scrollBy(0, distance);
        scrolled += distance;

        if (scrolled >= totalHeight) {
          clearInterval(timer);
          resolve(true);
        }
      }, delay);
    });
  });

  const xml = await page.evaluate(() => document.querySelector('*')?.outerHTML!);
  await page.waitForTimeout(1000);
  await browser.close();

  const root = parse(xml);
  const tableItem = root.querySelector('.hub-scrollable table');

  const rocketInvasions: RocketInvasion[] = [];
  
  const lineupSlotItems = tableItem.querySelectorAll('tr td .hub-flex-list,.hub-pokemon-list li');

  const lineups = category === 'Leader'
    ? [
      // Slot 1
      [lineupSlotItems[0]],
      // Slot 2
      [lineupSlotItems[1], lineupSlotItems[3], lineupSlotItems[5]],
      // Slot 3
      [lineupSlotItems[2], lineupSlotItems[4], lineupSlotItems[6]],
    ]
    : [
      // Slot 1
      [lineupSlotItems[0]],
      // Slot 2
      [lineupSlotItems[1], lineupSlotItems[3], lineupSlotItems[4]],
      // Slot 3
      [lineupSlotItems[2]],
    ];
  
  const lineupPokemons = lineups.reduce((all, lineupSlotItems, i) => {
    lineupSlotItems.forEach((lineupSlotItem) => {
      const lineupPokemonItems = lineupSlotItem.querySelectorAll('a');

      lineupPokemonItems.forEach((lineupPokemonItem, j) => {
        const slotNo = i + 1;
        const originalName = lineupPokemonItem.querySelector('.content .name')?.rawText.trim() ?? '';
        const pokemon = pokedex.getPokemonByFuzzyName(originalName);
        const imageUrl = lineupPokemonItem.querySelector('img')?.getAttribute('src') ?? '';
        const catchable = (category === 'Leader' && slotNo === 1) || (category === 'Boss' && slotNo === 3);
        const shinyAvailable = category === 'Leader' && lineupPokemonItem.classNames.includes('shiny');

        all.push({
          slotNo,
          no: pokemon.no,
          // name: pokemon.form ? `${pokemon.name} (${pokemon.form})` : pokemon.name,
          name: pokemon.name,
          originalName: originalName,
          types: pokemon.types,
          catchable,
          shinyAvailable,
          imageUrl,
        });
      });
    });

    return all;
  }, [] as LineupPokemon[]);

  rocketInvasions.push({
    quote: '',
    orignialQuote: '',
    category: categoryMapping(`${category} ${leaderName}`),
    characterImageUrl: characterImageUrlMapping(leaderName),
    isSpecial: true,
    lineupPokemons,
  });

  const sortedRocketInvasions = _.orderBy(rocketInvasions, (rocketInvasion) => {
    const matchedTag = tags.find((tag) => tag.displayText === rocketInvasion.category);
    return matchedTag?.priority;
  }, ['asc']);

  return sortedRocketInvasions;
};

const getRocketInvasions = async () => {
  return [
    ...await getGruntRocketInvasions(),
    ...await getLeaderRocketInvasions('Leader', 'Sierra'),
    ...await getLeaderRocketInvasions('Leader', 'Cliff'),
    ...await getLeaderRocketInvasions('Leader', 'Arlo'),
    ...await getLeaderRocketInvasions('Boss', 'Giovanni'),
  ];
};

export {
  getRocketInvasions,
};
