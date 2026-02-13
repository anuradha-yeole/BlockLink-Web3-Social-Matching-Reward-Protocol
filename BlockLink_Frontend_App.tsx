/**
 * BlockLink Frontend - Next.js React Component
 * Web3 Social Matching & Reward Protocol
 * Integrates with MetaMask and smart contracts via Web3.js
 */

import React, { useState, useEffect } from 'react';
import Web3 from 'web3';

// Contract ABIs
const BLOCKLINK_TOKEN_ABI = [
  {
    "constant": true,
    "inputs": [{"name": "_owner", "type": "address"}],
    "name": "balanceOf",
    "outputs": [{"name": "balance", "type": "uint256"}],
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [{"name": "_to", "type": "address"}, {"name": "_value", "type": "uint256"}],
    "name": "transfer",
    "outputs": [{"name": "", "type": "bool"}],
    "type": "function"
  }
];

const BLOCKLINK_PROTOCOL_ABI = [
  {
    "constant": false,
    "inputs": [{"name": "_role", "type": "uint256"}],
    "name": "registerUser",
    "outputs": [],
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {"name": "_peer1", "type": "address"},
      {"name": "_peer2", "type": "address"}
    ],
    "name": "createMatch",
    "outputs": [{"name": "", "type": "uint256"}],
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [{"name": "_matchId", "type": "uint256"}],
    "name": "verifyMatch",
    "outputs": [],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [{"name": "_user", "type": "address"}],
    "name": "getUserInfo",
    "outputs": [
      {"name": "userAddress", "type": "address"},
      {"name": "role", "type": "uint256"},
      {"name": "totalRewardsEarned", "type": "uint256"},
      {"name": "successfulMatches", "type": "uint256"},
      {"name": "isActive", "type": "bool"}
    ],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "getProtocolStats",
    "outputs": [
      {"name": "totalMatchesCreated", "type": "uint256"},
      {"name": "successfulMatchesVerified", "type": "uint256"},
      {"name": "successRate", "type": "uint256"}
    ],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [{"name": "_matchId", "type": "uint256"}],
    "name": "getMatchInfo",
    "outputs": [
      {"name": "matchId", "type": "uint256"},
      {"name": "matchmaker", "type": "address"},
      {"name": "peer1", "type": "address"},
      {"name": "peer2", "type": "address"},
      {"name": "rewardAmount", "type": "uint256"},
      {"name": "isVerified", "type": "bool"},
      {"name": "createdAt", "type": "uint256"},
      {"name": "completedAt", "type": "uint256"}
    ],
    "type": "function"
  }
];

interface UserData {
  address: string;
  role: number;
  totalRewards: string;
  successfulMatches: number;
  isActive: boolean;
}

interface Match {
  matchId: number;
  matchmaker: string;
  peer1: string;
  peer2: string;
  rewardAmount: string;
  isVerified: boolean;
  createdAt: number;
}

interface ProtocolStats {
  totalMatches: number;
  successfulMatches: number;
  successRate: number;
}

export default function BlockLinkApp() {
  // State variables
  const [web3, setWeb3] = useState<Web3 | null>(null);
  const [account, setAccount] = useState<string>('');
  const [contractAddress] = useState('0x...'); // Replace with actual contract address
  const [tokenAddress] = useState('0x...'); // Replace with actual token address
  const [userData, setUserData] = useState<UserData | null>(null);
  const [protocolStats, setProtocolStats] = useState<ProtocolStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Form states
  const [peer1, setPeer1] = useState('');
  const [peer2, setPeer2] = useState('');
  const [selectedRole, setSelectedRole] = useState('1'); // 1 = MATCHMAKER

  // Initialize Web3
  useEffect(() => {
    const initWeb3 = async () => {
      if ((window as any).ethereum) {
        const web3Instance = new Web3((window as any).ethereum);
        setWeb3(web3Instance);

        // Request account access
        const accounts = await (window as any).ethereum.request({ 
          method: 'eth_requestAccounts' 
        });
        setAccount(accounts[0]);
      } else {
        setErrorMessage('MetaMask not found. Please install MetaMask.');
      }
    };

    initWeb3();
  }, []);

  // Fetch user data and protocol stats
  useEffect(() => {
    if (web3 && account) {
      fetchUserData();
      fetchProtocolStats();
    }
  }, [web3, account]);

  const fetchUserData = async () => {
    try {
      const contract = new web3!.eth.Contract(
        BLOCKLINK_PROTOCOL_ABI as any,
        contractAddress
      );

      const data = await contract.methods.getUserInfo(account).call();
      setUserData({
        address: data[0],
        role: parseInt(data[1]),
        totalRewards: web3!.utils.fromWei(data[2], 'ether'),
        successfulMatches: parseInt(data[3]),
        isActive: data[4]
      });
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  const fetchProtocolStats = async () => {
    try {
      const contract = new web3!.eth.Contract(
        BLOCKLINK_PROTOCOL_ABI as any,
        contractAddress
      );

      const stats = await contract.methods.getProtocolStats().call();
      setProtocolStats({
        totalMatches: parseInt(stats[0]),
        successfulMatches: parseInt(stats[1]),
        successRate: parseInt(stats[2])
      });
    } catch (error) {
      console.error('Error fetching protocol stats:', error);
    }
  };

  // Register user
  const registerUser = async () => {
    if (!web3 || !account) {
      setErrorMessage('Web3 not initialized or account not connected');
      return;
    }

    setLoading(true);
    try {
      const contract = new web3.eth.Contract(
        BLOCKLINK_PROTOCOL_ABI as any,
        contractAddress
      );

      const tx = contract.methods.registerUser(selectedRole).send({ from: account });

      tx.on('transactionHash', (hash: string) => {
        setSuccessMessage(`Transaction sent: ${hash}`);
      });

      await tx;
      setSuccessMessage('User registered successfully!');
      fetchUserData();
    } catch (error: any) {
      setErrorMessage(`Error registering user: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Create match
  const createMatch = async () => {
    if (!web3 || !account) {
      setErrorMessage('Web3 not initialized or account not connected');
      return;
    }

    if (!peer1 || !peer2) {
      setErrorMessage('Please enter both peer addresses');
      return;
    }

    if (!web3.utils.isAddress(peer1) || !web3.utils.isAddress(peer2)) {
      setErrorMessage('Invalid Ethereum address');
      return;
    }

    setLoading(true);
    try {
      const contract = new web3.eth.Contract(
        BLOCKLINK_PROTOCOL_ABI as any,
        contractAddress
      );

      const tx = contract.methods
        .createMatch(peer1, peer2)
        .send({ from: account });

      tx.on('transactionHash', (hash: string) => {
        setSuccessMessage(`Match created! Transaction: ${hash}`);
      });

      await tx;
      setPeer1('');
      setPeer2('');
      fetchProtocolStats();
    } catch (error: any) {
      setErrorMessage(`Error creating match: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Verify match
  const verifyMatch = async (matchId: number) => {
    if (!web3 || !account) {
      setErrorMessage('Web3 not initialized or account not connected');
      return;
    }

    setLoading(true);
    try {
      const contract = new web3.eth.Contract(
        BLOCKLINK_PROTOCOL_ABI as any,
        contractAddress
      );

      const tx = contract.methods.verifyMatch(matchId).send({ from: account });

      tx.on('transactionHash', (hash: string) => {
        setSuccessMessage(`Match verified! Transaction: ${hash}`);
      });

      await tx;
      fetchProtocolStats();
    } catch (error: any) {
      setErrorMessage(`Error verifying match: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const getRoleName = (role: number) => {
    const roles = ['NONE', 'MATCHMAKER', 'VERIFIER', 'ADMIN'];
    return roles[role] || 'UNKNOWN';
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>BlockLink - Web3 Social Matching Protocol</h1>

      {/* Account Info */}
      <div style={{ backgroundColor: '#f0f0f0', padding: '15px', borderRadius: '5px', marginBottom: '20px' }}>
        <h2>Account Information</h2>
        <p><strong>Connected Account:</strong> {account || 'Not connected'}</p>
        {userData && (
          <div>
            <p><strong>Role:</strong> {getRoleName(userData.role)}</p>
            <p><strong>Total Rewards Earned:</strong> {userData.totalRewards} BLINK</p>
            <p><strong>Successful Matches:</strong> {userData.successfulMatches}</p>
            <p><strong>Status:</strong> {userData.isActive ? 'Active' : 'Inactive'}</p>
          </div>
        )}
      </div>

      {/* Protocol Stats */}
      {protocolStats && (
        <div style={{ backgroundColor: '#e8f4f8', padding: '15px', borderRadius: '5px', marginBottom: '20px' }}>
          <h2>Protocol Statistics</h2>
          <p><strong>Total Matches Created:</strong> {protocolStats.totalMatches}</p>
          <p><strong>Successful Matches:</strong> {protocolStats.successfulMatches}</p>
          <p><strong>Success Rate:</strong> {protocolStats.successRate}%</p>
        </div>
      )}

      {/* Register User */}
      <div style={{ border: '1px solid #ccc', padding: '15px', borderRadius: '5px', marginBottom: '20px' }}>
        <h2>Register as User</h2>
        <div>
          <label>
            Select Role:
            <select 
              value={selectedRole} 
              onChange={(e) => setSelectedRole(e.target.value)}
              style={{ marginLeft: '10px' }}
            >
              <option value="1">Matchmaker</option>
              <option value="2">Verifier</option>
              <option value="3">Admin</option>
            </select>
          </label>
        </div>
        <button 
          onClick={registerUser}
          disabled={loading}
          style={{ marginTop: '10px', padding: '10px 20px', cursor: loading ? 'not-allowed' : 'pointer' }}
        >
          {loading ? 'Processing...' : 'Register User'}
        </button>
      </div>

      {/* Create Match */}
      <div style={{ border: '1px solid #ccc', padding: '15px', borderRadius: '5px', marginBottom: '20px' }}>
        <h2>Create Peer Match</h2>
        <div>
          <input
            type="text"
            placeholder="Peer 1 Address"
            value={peer1}
            onChange={(e) => setPeer1(e.target.value)}
            style={{ width: '100%', padding: '8px', marginBottom: '10px', boxSizing: 'border-box' }}
          />
          <input
            type="text"
            placeholder="Peer 2 Address"
            value={peer2}
            onChange={(e) => setPeer2(e.target.value)}
            style={{ width: '100%', padding: '8px', marginBottom: '10px', boxSizing: 'border-box' }}
          />
        </div>
        <button 
          onClick={createMatch}
          disabled={loading}
          style={{ padding: '10px 20px', cursor: loading ? 'not-allowed' : 'pointer' }}
        >
          {loading ? 'Processing...' : 'Create Match'}
        </button>
      </div>

      {/* Messages */}
      {successMessage && (
        <div style={{ backgroundColor: '#d4edda', color: '#155724', padding: '10px', borderRadius: '5px', marginBottom: '10px' }}>
          {successMessage}
        </div>
      )}

      {errorMessage && (
        <div style={{ backgroundColor: '#f8d7da', color: '#721c24', padding: '10px', borderRadius: '5px', marginBottom: '10px' }}>
          {errorMessage}
        </div>
      )}
    </div>
  );
}
