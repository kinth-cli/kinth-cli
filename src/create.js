const fs = require('fs');
const axios = require('axios');
const ora = require('ora');
const Inquirer = require('inquirer');
const { promisify } = require('util');
const path = require('path');
const chalk = require('chalk');
const MetalSmith = require('metalsmith');
let { render } = require('consolidate').ejs;
let downloadGitRepo = require('download-git-repo');
let ncp = require('ncp');

render = promisify(render);
downloadGitRepo = promisify(downloadGitRepo);
const { downloadDirectory } = require('./constants');

ncp = promisify(ncp);
// 在github创建公司自己的组织，组织中可以放不同的模版
// https://api.github.com/orgs/kinth-cli/repos
// 通过github接口获取模版列表

// 1.获取项目列表
const fetchRepoList = async () => {
  const { data } = await axios.get('https://api.github.com/orgs/kinth-cli/repos');
  return data;
};

// 获取项目的版本号
const fetchTagList = async (repo) => {
  const { data } = await axios.get(`https://api.github.com/repos/kinth-cli/${repo}/tags`);
  return data;
};

// 封装loading效果
const waitLoading = (fn, message) => async (...args) => {
  const spinner = ora(chalk.green(message));
  spinner.start();
  const result = await fn(...args);
  spinner.succeed();
  return result;
};

// 下载模版
const download = async (repo, tag) => {
  let api = `kinth-cli/${repo}`;
  if (tag) {
    api += `#${tag}`;
  }
  // /user/xxxx/.template/repo
  const dest = `${downloadDirectory}/${repo}`;
  await downloadGitRepo(api, dest);
  return dest; // 下载的最终目录
};


module.exports = async (projectName = 'my-project') => {
  if (fs.existsSync(projectName)) {
    console.log(chalk.red('Folder already exists.'));
  } else {
  // 1.获取组织下的所有模版;
    let repos = await waitLoading(fetchRepoList, 'fetching template...')();
    repos = repos.map((item) => item.name);
    const { repo } = await Inquirer.prompt({
      name: 'repo',
      type: 'list',
      message: 'please choise a template to create project',
      choices: repos,
    });

    // 2.获取当前选择项目的对应版本号
    let tags = await waitLoading(fetchTagList, 'fetching tags...')(repo);
    let result;
    if (tags.length > 0) {
      tags = tags.map((item) => item.name);
      const { tag } = await Inquirer.prompt({
        name: 'tag',
        type: 'list',
        message: 'please choise tags to create project',
        choices: tags,
      });
      result = await waitLoading(download, 'download template...')(repo, tag);
    } else {
      result = await waitLoading(download, 'download template...')(repo);
    }

    if (!fs.existsSync(path.join(result, 'ask.js'))) {
      try {
        await ncp(result, path.resolve(projectName));
        console.log('\r\n', chalk.green(`cd ${projectName}\r\n`), chalk.yellow('npm install\r\n'));
      } catch (error) {
        console.log(error);
      }
    } else {
      await new Promise((resolve, reject) => {
        MetalSmith(__dirname)
          .source(result)
          .destination(path.resolve(projectName))
          .use(async (files, metal, done) => {
            const args = require(path.join(result, 'ask.js'));
            const select = await Inquirer.prompt(args);
            const meta = metal.metadata(); // 用户填写的结果
            Object.assign(meta, select);
            delete files['ask.js'];
            done();
          })
          .use((files, metal, done) => {
            const obj = metal.metadata();
            Reflect.ownKeys(files).forEach(async (file) => {
              if (file.includes('js') || file.includes('json')) {
                let content = files[file].contents.toString();
                if (content.includes('<%')) {
                  content = await render(content, obj);
                  files[file].contents = Buffer.from(content);
                }
              }
            });
            done();
          })
          .build((err) => {
            if (err) {
              reject();
            } else {
              console.log('\r\n', chalk.green(`cd ${projectName}\r\n`), chalk.yellow('npm install\r\n'));
              resolve();
            }
          });
      });
    }
  }
};
