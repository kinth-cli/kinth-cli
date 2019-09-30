const program = require('commander');
const path = require('path');
const { version } = require('./constants');

const mapAction = {
  create: {
    alias: 'c',
    description: 'create a project',
    examples: [
      'kinth-cli create <project-name>',
    ],
  },
  config: {
    alias: 'conf',
    description: 'config seting',
    examples: [],
  },
  '*': {
    alias: '',
    description: 'command not found',
    examples: [],
  },
};
Reflect.ownKeys(mapAction).forEach((action) => {
  program
    .command(action)
    .alias(mapAction[action].alias)
    .description(mapAction[action].description)
    .action(() => {
      if (action === '*') {
        console.log(mapAction[action].description);
      } else {
        // if (!process.argv.slice(3)[0] && (action === 'create' || action === 'c')) {
        //   mapAction[action].examples.forEach((item) => {
        //     console.log(item);
        //   });
        //   return false;
        // }
        require(path.resolve(__dirname, action))(...process.argv.slice(3));
      }
    });
});

program.on('--help', () => {
  console.log('\nExample');
  Reflect.ownKeys(mapAction).forEach((action) => {
    mapAction[action].examples.forEach((item) => {
      console.log(item);
    });
  });
});

program
  .version(version)
  .parse(process.argv);
