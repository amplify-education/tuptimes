const tap = require("tap");
const cp = require("child_process");
const path = require("path");
const fs = require("fs");
const { createSummaryStream } = require("..");

const fixtureDir = path.join(__dirname, "fixture");
const fixtures = fs.readdirSync(fixtureDir)
  .filter(s => s.endsWith('.input.log'))
  .map(s => s.replace('.input.log', ''))

for (const fixture of fixtures) {
  tap.test(fixture, async t => {
    const output = await runTupTime(fixture);
    const expectedFile = path.join(fixtureDir, `${fixture}.expected.log`);
    const expected = fs.readFileSync(expectedFile, "utf8");
    if (process.env.UPDATE && expected !== output) {
      fs.writeFileSync(expectedFile, output);
      console.log('Updated ' + expectedFile);
    }
    t.equal(output, expected);
  });
}

function runTupTime(fixture) {
  const fixtureFile = path.join(fixtureDir, `${fixture}.input.log`);
  const config = JSON.parse(fs.readFileSync(path.join(fixtureDir, `${fixture}.config.json`)))
  for (const g of config.groups) {
    g.pattern = new RegExp(g.pattern)
  }
  const stream = createSummaryStream(fs.createReadStream(fixtureFile), config)
  return new Promise((resolve, reject) => {
    let data = "";
    stream.on("data", chunk => (data += chunk));
    stream.on("end", () => resolve(data));
    stream.on("error", error => reject(error));
  });
}
