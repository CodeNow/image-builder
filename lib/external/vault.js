'use strict'

const fs = require('fs')
const Vault = require('node-vault')

class VaultManager {
  constructor () {
    const vaultToken = fs.readFileSync(process.env.RUNNABLE_VAULT_TOKEN_FILE_PATH).trim()
    this._vault = Vault({
      apiVersion: 'v1',
      endpoint: process.env.RUNNABLE_VAULT_ENDPOINT,
      token: vaultToken
    })
  }

  readRegistryPassword () {
    return this._vault.read(`secret/organization/${process.env.RUNNABLE_ORG_ID}/registry/password`)
  }
}

module.exports = new VaultManager()
