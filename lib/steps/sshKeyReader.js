'use strict';

const Promise = require('bluebird')
const fs = require('fs')
Promise.promisifyAll(fs)
const vault = require('../external/vault')
const utils = require('../utils')

module.exports = {
  createSSHKeys: () => {
    const sshPath = '/root/.ssh/'
    const keyUserIds = process.env.SSH_KEY_IDS.split(',')
    utils.log(process.env.SSH_KEY_IDS, process.env.SSH_KEY_NAMES, 'here are the keys and names')

    let keyCreators = keyUserIds.map((id) => {
      return vault.readUserSSHKey(id)
        .then((key) => {
          if (key) {
            fs.writeFile(sshPath + id, key)
              .then((result) => {
                utils.log(result)
              })
          }
        })
    })
    return Promise.all(keyCreators)
  },

  addToKeyring: (dockerfile) => {
    let startIndex = 2
    const sshPath = '/root/.ssh/'
    fs.readdirAsync(sshPath)
      .then((items) => {
        dockerfile.splice(startIndex, 0, 'RUN ssh-keyscan -H github.com > /etc/ssh/ssh_known_hosts')
        items.forEach((keyName) => {
          console.log(keyName)
          let keyPath = sshPath + keyName
          fs.readFile(keyPath, 'UTF-8', function (err, good) {
            utils.log(good)
          });
          dockerfile.splice(++startIndex, 0, 'RUN chmod 0600 ' + keyPath + ' ' + '&& echo "IdentityFile ' + keyPath + ' >> /etc/ssh/ssh_config')
        })
      })
      .then((result) => {
        return dockerfile
      })
  }
}
