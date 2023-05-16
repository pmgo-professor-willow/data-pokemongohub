// Node modules.
import { mkdirp, writeFile } from 'fs-extra';
// Local modules.
import { getRocketInvasions } from './rocketInvasions';

const main = async () => {
  const outputPath = './artifacts';
  await mkdirp(outputPath);

  // community days.
  try {
    const rocketInvasions = await getRocketInvasions();
    await writeFile(`${outputPath}/rocketInvasions.json`, JSON.stringify(rocketInvasions, null, 2));
    await writeFile(`${outputPath}/rocketInvasions.min.json`, JSON.stringify(rocketInvasions));
  } catch (e) {
    console.error(e);
  }
};

main();
