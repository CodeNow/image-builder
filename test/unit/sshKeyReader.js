'use strict';

const Lab = require('lab');
const lab = exports.lab = Lab.script();
const expect = require('code').expect;
const it = lab.test;
const beforeEach = lab.beforeEach;
const afterEach = lab.afterEach
const sshKeyReader = require('../../lib/steps/sshKeyReader')
const vault = require('../../lib/external/vault')
const sinon = require('sinon');
const rsaKey = '-----BEGIN RSA PRIVATE KEY-----'

const mockDockerfile = [
  'FROM runnable/node-starter',
  'MAINTAINER Runnable, Inc.',
  '# Cache NPM Install',
  'RUN npm install'
]

lab.experiment('sshKeyReader.js', () => {
  lab.experiment('createSShKeys', () => {
    beforeEach((done) => {
      sinon.stub(vault, 'readUserSSHKey').resolves({
        data: {
          value: rsaKey
        }
      })
      done()
    })
    afterEach((done) => {
      delete process.env.RUNNABLE_SSH_KEY_IDS
      vault.readUserSSHKey.restore()
      done()
    })
      it('should produce an id and key object', (done) => {
        process.env.RUNNABLE_SSH_KEY_IDS = '13';
        sshKeyReader.createSSHKeys()
          .then((keys) => {
            expect(keys.SSH_KEY_13).to.equal(rsaKey)
            sinon.assert.calledOnce(vault.readUserSSHKey)
            sinon.assert.calledWith(vault.readUserSSHKey, '13')
            done();
          })
      });
      it('should produce multiple keys and ids', (done) => {
        process.env.RUNNABLE_SSH_KEY_IDS = '13,31';
        sshKeyReader.createSSHKeys()
          .then((keys) => {
            expect(keys.SSH_KEY_13).to.equal(rsaKey)
            expect(keys.SSH_KEY_31).to.equal(rsaKey)
            sinon.assert.calledTwice(vault.readUserSSHKey)
            done();
          })
      });
      it('should produce an empty object if no keys', (done) => {
        process.env.RUNNABLE_SSH_KEY_IDS = '';
        vault.readUserSSHKey.restore()
        sinon.stub(vault, 'readUserSSHKey').resolves({
          data: {
            value: rsaKey
          }
        })
        sshKeyReader.createSSHKeys()
          .then((keys) => {
            expect(keys.SSH_KEY_13).to.equal(undefined)
            sinon.assert.calledOnce(vault.readUserSSHKey)
            done();
          })
      });
    });
  lab.experiment('addToKeyring', () => {
    beforeEach((done) => {
      process.env.RUNNABLE_SSH_KEY_IDS = '13';
      done()
    })
    afterEach((done) => {
      delete process.env.RUNNABLE_SSH_KEY_IDS
      done()
    })
      it('should add github.com to the known hosts file', (done) => {
        let dockerfile = sshKeyReader.addToKeyring(mockDockerfile)
        expect(dockerfile[2]).to.equal('RUN ssh-keyscan -H github.com > /etc/ssh/ssh_known_hosts')
        done()
      })
      it('should create a directory for ssh keys', (done) => {
        let dockerfile = sshKeyReader.addToKeyring(mockDockerfile)
        expect(dockerfile[3]).to.equal('RUN mkdir /ssh-keys/')
        done()
      })
      it('should accept an ssh key build arg', (done) => {
        let dockerfile = sshKeyReader.addToKeyring(mockDockerfile)
        expect(dockerfile[4]).to.equal('ARG SSH_KEY_13')
        done()
      })
      it('should echo the key to a file', (done) => {
        let dockerfile = sshKeyReader.addToKeyring(mockDockerfile)
        expect(dockerfile[5]).to.equal('RUN echo $SSH_KEY_13 >> /ssh-keys/13')
        done()
      })
      it('edit permissions on that file and add it to config', (done) => {
        let dockerfile = sshKeyReader.addToKeyring(mockDockerfile)
        expect(dockerfile[6]).to.equal('RUN chmod 0600 /ssh-keys/13 && ' +
          'echo "IdentityFile /ssh-keys/13" >> /etc/ssh/ssh_config')
        done()
      })
      it('remove that file at the end of the build process', (done) => {
        let dockerfile = sshKeyReader.addToKeyring(mockDockerfile)
        expect(dockerfile[dockerfile.length - 1]).to.equal('RUN rm /ssh-keys/13')
        done()
      })
    })
});
