const stream = require("stream");
const pumpify = require("pumpify");
const split = require("split2");
const stripColor = require("better-strip-color");
const chalk = require("chalk");

class TupSummary {
  constructor(options) {
    this.options = options;
    this.totalTime = 0;
    this.totalCommands = 0;
    this.groups = {};
    this.start = Date.now();
  }

  addCommand(line) {
    const parsed = this.parseCommandLine(line);
    if (!parsed) return {
      highlighted: line
    };

    const { time, directory, command, group } = parsed;
    this.totalTime += time;
    this.totalCommands++;
    if (!this.groups[group]) {
      this.groups[group] = {
        time: 0,
        commands: []
      };
    }
    this.groups[group].time += time;
    this.groups[group].commands.push(command);
    return parsed;
  }

  parseCommandLine(line) {
    const stripped = stripColor(line);
    // Parse lines from tup log corresponding to execution of a command:
    // ~50% 1) [0.010s] cp blah.js build/blah.js
    // 100% 2) [1.017s] cp blah2.js build/blah2.js
    //                progress %....    [   time    ]   dir.....:   cmd
    const match = /\s+~?\d+%\s+\d+\)\s+\[([0-9.]+)s\]\s+([^:]*:)?\s*(.*)/.exec(
      stripped
    );
    if (!match) return undefined;

    let group;
    let highlighted = chalk`{yellow ${line}}`;
    for (const g of this.options.groups) {
      if (g.pattern.test(stripped)) {
        group = g.name;
        highlighted = line.replace(g.pattern, (s) => chalk`{blue.bold.underline ${s}}`)
      }
    }
    group = group || "uncategorized";

    return {
      time: parseFloat(match[1]),
      directory: match[2],
      command: match[3],
      group,
      highlighted
    };
  }

  toString() {
    const groups = Object.entries(
      this.groups
    ).map(([name, { time, commands }]) => ({ name, time, commands }))
    .sort((g1, g2) => (g1.time < g2.time ? 1 : -1))

    const wallTime = (Date.now() - this.start) / 1000;

    let result = chalk`
{green.bold.underline Tup build finished}
{bold Total time: ${this.totalTime.toFixed(3)}s} {bold Wall time: ${wallTime.toFixed(3)}s} {gray (${this.totalCommands} commands)}
`;
    for (const {name, time, commands} of groups) {
      result += chalk`  ‣${name}: ${time.toFixed(3)}s {gray (${commands.length} commands)}\n`
    }

    const uncategorized = groups.find(g => g.name === 'uncategorized');
    if (uncategorized && uncategorized.commands.length > 0) {
      result += chalk`\n{yellow.underline Uncategorized Commands}\n`
      for (const command of uncategorized.commands) {
        result += command + '\n'
      }
    }

    return result;
  }
}

class TupLogSummaryStream extends stream.Transform {
  constructor(config) {
    super({
      writableObjectMode: true,
      transform(line, encoding, callback) {
        this.handleLine(line, callback);
      },
      flush(callback) {
        if (this.tupJob) this.push(this.tupJob.toString());
        callback();
      }
    });
    this.state = "pending";
    this.config = config;
  }

  handleLine(line, callback) {
    const stripped = stripColor(line);
    if (/\[ tup \] \[.*\] Executing Commands/.test(stripped)) {
      this.push(line + "\n");
      this.state = "executing";
      if (this.tupJob) {
        this.push(this.tupJob.toString());
      }
      this.tupJob = new TupSummary(this.config);
    } else if (this.state === "executing" && /(\[ tup \])/.test(stripped)) {
      this.push(chalk`{gray ${line}}` + "\n");
      this.push(this.tupJob.toString());
      this.state = "pending";
      this.tupJob = undefined;
    } else if (this.state === "executing") {
      const {highlighted} = this.tupJob.addCommand(line);
      this.push(highlighted + "\n");
    } else {
      this.push(chalk`{gray ${line}}` + "\n");
    }
    callback();
  }
}

/**
 * Given a readable stream serving up a raw tup log, returns a stream of that
 * log, annotated with timing statistics for each completed tup execution.
 *
 */
function createSummaryStream(rawTupLogStream, config) {
  return pumpify(rawTupLogStream, split(), new TupLogSummaryStream(config));
}

module.exports = {
  TupSummary,
  TupLogSummaryStream,
  createSummaryStream
};
