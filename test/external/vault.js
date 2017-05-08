'use strict'

const fs = require('fs')
const Lab = require('lab')
const lab = exports.lab = Lab.script()
const expect = require('code').expect
const sinon = require('sinon')
const vault = require('../../lib/external/vault')

lab.experiment('vault.js unit test', () => {
  lab.experiment('valid', () => {
    lab.beforeEach((done) => {
      sinon.stub(fs, 'readFileSync').returns('vault-token\n ')
      process.env.RUNNABLE_VAULT_TOKEN_FILE_PATH = '/some-path'
      done()
    })
    lab.afterEach((done) => {
      fs.readFileSync.restore()
      delete process.env.RUNNABLE_VAULT_TOKEN_FILE_PATH
      done()
    })
    lab.it('should setup unix socket', (done) => {
      const vault = new vault_VaultManager()
      expect(vault._vault).to.exist()
      sinon.assert.calledOnce(fs.readFileSync)
      sinon.assert.calledWithExactly(fs.readFileSync,
        process.env.RUNNABLE_VAULT_TOKEN_FILE_PATH, 'utf8')
      done()
    })
    // lab.it('should setup with remote', function(done) {
    //   const host = '10.234.129.94'
    //   const port = '5354'
    //   const remote = 'tcp://'+host+':'+port
    //   process.env.RUNNABLE_DOCKER = remote
    //   const d = docker()
    //   expect(d.modem.host).to.equal(host)
    //   expect(d.modem.port).to.equal(port)
    //   done()
    // })
  })
  // lab.experiment('invalid', function () {
  //   lab.it('should throw if RUNNABLE_DOCKER not set', function(done) {
  //     try {
  //       docker()
  //     } catch (err) {
  //       return done()
  //     }
  //     done(new Error('should have thrown'))
  //   })
  //   lab.it('should throw if RUNNABLE_DOCKER has invalid input', function(done) {
  //     ['google',
  //     'unix',
  //     'unix:/bad/place',
  //     'http://',
  //     'http://google',
  //     'http://:235',
  //     ':235',
  //     'google:123'].forEach(function(testItem) {
  //       process.env.RUNNABLE_DOCKER = testItem
  //       try {
  //         docker()
  //       } catch (err) {
  //         return
  //       }
  //       console.log(testItem)
  //     })
  //     done()
  //   })
  // })
})
