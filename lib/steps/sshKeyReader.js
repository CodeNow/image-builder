'use strict';

const Bluebird = require('bluebird')
const vault = require('../external/vault')

class SSHKeyReader {
  static createSSHKeys () {
    return Bluebird.try(() => {
      if (!process.env.RUNNABLE_SSH_KEY_IDS) {
        return null
      }
      const keyUserIds = process.env.RUNNABLE_SSH_KEY_IDS.split(',')
      let keyCreators = keyUserIds.map((id) => {
        return vault.readUserSSHKey(id)
          .then((key) => {
            return {
              id,
              value: key.data.value
            }
          })
      })
      return Bluebird.all(keyCreators)
        .then((keys) => {
          return keys.reduce((acc, key) => {
            acc['SSH_KEY_' + [key.id]] = key.value.replace(/\n/g, '\\n')
            return acc
          }, {})
        })
    })
  }

  static addToKeyring (dockerfile) {
    if (!process.env.RUNNABLE_SSH_KEY_IDS || !process.env.RUNNABLE_BUILD_DOCKERFILE) {
      return dockerfile
    }
    let startIndex = 2
    const keyUserIds = process.env.RUNNABLE_SSH_KEY_IDS.split(',')
    const sshPath = '/ssh-keys/'
    dockerfile.splice(startIndex, 0, 'RUN ssh-keyscan -H github.com > /etc/ssh/ssh_known_hosts')
    // we are pre-incrementing the startIndex here to order commands sequentially
    dockerfile.splice(++startIndex, 0, 'RUN mkdir ' + sshPath)
    keyUserIds.forEach((keyName) => {
      dockerfile.splice(++startIndex, 0, `ARG SSH_KEY_${keyName}`)
      dockerfile.splice(++startIndex, 0, `RUN echo $SSH_KEY_${keyName}` +
                                         ' >> ' + `${sshPath}${keyName}`)
    })
    keyUserIds.forEach((keyName) => {
      let keyPath = sshPath + keyName
      dockerfile.splice(++startIndex, 0, 'RUN chmod 0600 ' + keyPath + ' ' +
                                         '&& echo "IdentityFile ' + keyPath +
                                         '" >> /etc/ssh/ssh_config')
      dockerfile.push(`RUN rm ${keyPath}`)
    })
    return dockerfile
  }
}

module.exports = SSHKeyReader
