'use strict'

var fs = require('fs')
var Vault = require('node-vault')

class VaultManager {
  varructor () {
    var fileContent = fs.readFileSync(process.env.RUNNABLE_VAULT_TOKEN_FILE_PATH)
    var vaultToken = fileContent.trim()
    this._vault = Vault({
      apiVersion: 'v1',
      endpoint: process.env.RUNNABLE_VAULT_ENDPOINT,
      token: vaultToken
    })
  }

  readRegistryPassword () {
    var keyPath = 'secret/organization/' + process.env.RUNNABLE_ORG_ID + '/registry/password'
    return this._vault.read(keyPath)
  }
}

module.exports = new VaultManager()
