// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title BlockLink Reward Token
 * @dev ERC-20 token for the BlockLink social matching platform
 */
contract BlockLinkToken is ERC20, Ownable {
    constructor(uint256 initialSupply) ERC20("BlockLink", "BLINK") {
        _mint(msg.sender, initialSupply * 10 ** decimals());
    }

    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }

    function burn(uint256 amount) public {
        _burn(msg.sender, amount);
    }
}

/**
 * @title BlockLink Reward Protocol
 * @dev Smart contract for managing trustless peer-to-peer reward distribution
 * Enables matchmakers to earn rewards for successful peer connections
 */
contract BlockLinkRewardProtocol is ReentrancyGuard, Ownable {
    
    // ============ State Variables ============
    
    BlockLinkToken public rewardToken;
    
    // Role definitions
    enum Role { NONE, MATCHMAKER, VERIFIER, ADMIN }
    
    // User structure
    struct User {
        address userAddress;
        Role role;
        uint256 totalRewardsEarned;
        uint256 successfulMatches;
        bool isActive;
    }
    
    // Match structure
    struct Match {
        uint256 matchId;
        address matchmaker;
        address peer1;
        address peer2;
        uint256 rewardAmount;
        bool isVerified;
        uint256 createdAt;
        uint256 completedAt;
    }
    
    // ============ Mappings ============
    
    mapping(address => User) public users;
    mapping(uint256 => Match) public matches;
    mapping(address => bool) public verifiers;
    
    // ============ State Variables ============
    
    uint256 public matchCounter = 0;
    uint256 public constant REWARD_AMOUNT = 100 * 10 ** 18; // 100 tokens in wei
    uint256 public totalMatches = 0;
    uint256 public successfulMatches = 0;
    
    // ============ Events ============
    
    event UserRegistered(address indexed user, Role role);
    event MatchCreated(uint256 indexed matchId, address indexed matchmaker, address peer1, address peer2);
    event MatchVerified(uint256 indexed matchId, address indexed verifier);
    event RewardDistributed(uint256 indexed matchId, address indexed matchmaker, uint256 amount);
    event RoleAssigned(address indexed user, Role role);
    
    // ============ Constructor ============
    
    constructor(address _tokenAddress) {
        rewardToken = BlockLinkToken(_tokenAddress);
        verifiers[msg.sender] = true;
    }
    
    // ============ User Management ============
    
    /**
     * @dev Register a new user with a specific role
     * @param _role The role to assign to the user (MATCHMAKER, VERIFIER, ADMIN)
     */
    function registerUser(Role _role) external {
        require(_role != Role.NONE, "Invalid role");
        require(!users[msg.sender].isActive, "User already registered");
        
        users[msg.sender] = User({
            userAddress: msg.sender,
            role: _role,
            totalRewardsEarned: 0,
            successfulMatches: 0,
            isActive: true
        });
        
        if (_role == Role.VERIFIER) {
            verifiers[msg.sender] = true;
        }
        
        emit UserRegistered(msg.sender, _role);
    }
    
    /**
     * @dev Assign a role to a user (only owner)
     * @param _user The user address
     * @param _role The role to assign
     */
    function assignRole(address _user, Role _role) external onlyOwner {
        require(users[_user].isActive, "User not registered");
        require(_role != Role.NONE, "Invalid role");
        
        users[_user].role = _role;
        
        if (_role == Role.VERIFIER) {
            verifiers[_user] = true;
        }
        
        emit RoleAssigned(_user, _role);
    }
    
    // ============ Match Management ============
    
    /**
     * @dev Create a new peer match (called by matchmaker)
     * @param _peer1 Address of first peer
     * @param _peer2 Address of second peer
     */
    function createMatch(
        address _peer1,
        address _peer2
    ) external nonReentrant returns (uint256) {
        require(users[msg.sender].isActive, "Matchmaker not registered");
        require(users[msg.sender].role == Role.MATCHMAKER, "Only matchmakers can create matches");
        require(_peer1 != address(0) && _peer2 != address(0), "Invalid peer addresses");
        require(_peer1 != _peer2, "Peers must be different");
        
        uint256 matchId = matchCounter++;
        totalMatches++;
        
        matches[matchId] = Match({
            matchId: matchId,
            matchmaker: msg.sender,
            peer1: _peer1,
            peer2: _peer2,
            rewardAmount: REWARD_AMOUNT,
            isVerified: false,
            createdAt: block.timestamp,
            completedAt: 0
        });
        
        emit MatchCreated(matchId, msg.sender, _peer1, _peer2);
        
        return matchId;
    }
    
    /**
     * @dev Verify a match and distribute rewards (called by verifier)
     * @param _matchId The match ID to verify
     */
    function verifyMatch(uint256 _matchId) external nonReentrant {
        require(verifiers[msg.sender], "Only verifiers can verify matches");
        require(_matchId < matchCounter, "Invalid match ID");
        
        Match storage matchData = matches[_matchId];
        require(!matchData.isVerified, "Match already verified");
        require(matchData.createdAt != 0, "Match does not exist");
        
        // Mark as verified
        matchData.isVerified = true;
        matchData.completedAt = block.timestamp;
        successfulMatches++;
        
        emit MatchVerified(_matchId, msg.sender);
        
        // Distribute reward to matchmaker
        _distributeReward(_matchId);
    }
    
    /**
     * @dev Internal function to distribute rewards
     * @param _matchId The match ID
     */
    function _distributeReward(uint256 _matchId) internal {
        Match storage matchData = matches[_matchId];
        address matchmaker = matchData.matchmaker;
        uint256 rewardAmount = matchData.rewardAmount;
        
        require(rewardToken.balanceOf(address(this)) >= rewardAmount, "Insufficient reward token balance");
        
        // Update user stats
        users[matchmaker].totalRewardsEarned += rewardAmount;
        users[matchmaker].successfulMatches++;
        
        // Transfer reward
        rewardToken.transfer(matchmaker, rewardAmount);
        
        emit RewardDistributed(_matchId, matchmaker, rewardAmount);
    }
    
    // ============ Getter Functions ============
    
    /**
     * @dev Get user information
     * @param _user The user address
     */
    function getUserInfo(address _user) external view returns (User memory) {
        return users[_user];
    }
    
    /**
     * @dev Get match information
     * @param _matchId The match ID
     */
    function getMatchInfo(uint256 _matchId) external view returns (Match memory) {
        require(_matchId < matchCounter, "Invalid match ID");
        return matches[_matchId];
    }
    
    /**
     * @dev Get matchmaker's stats
     * @param _matchmaker The matchmaker address
     */
    function getMatchmakerStats(address _matchmaker) external view returns (
        uint256 totalRewards,
        uint256 successfulMatches,
        bool isActive
    ) {
        User memory user = users[_matchmaker];
        return (user.totalRewardsEarned, user.successfulMatches, user.isActive);
    }
    
    /**
     * @dev Get protocol statistics
     */
    function getProtocolStats() external view returns (
        uint256 totalMatchesCreated,
        uint256 successfulMatchesVerified,
        uint256 successRate
    ) {
        uint256 rate = totalMatches > 0 ? (successfulMatches * 100) / totalMatches : 0;
        return (totalMatches, successfulMatches, rate);
    }
    
    // ============ Admin Functions ============
    
    /**
     * @dev Fund the contract with reward tokens
     * @param _amount The amount to fund
     */
    function fundRewards(uint256 _amount) external onlyOwner {
        require(_amount > 0, "Invalid amount");
        rewardToken.transferFrom(msg.sender, address(this), _amount);
    }
    
    /**
     * @dev Withdraw excess tokens (only owner)
     * @param _amount The amount to withdraw
     */
    function withdrawTokens(uint256 _amount) external onlyOwner {
        require(_amount > 0, "Invalid amount");
        require(rewardToken.balanceOf(address(this)) >= _amount, "Insufficient balance");
        rewardToken.transfer(msg.sender, _amount);
    }
    
    /**
     * @dev Get contract token balance
     */
    function getContractBalance() external view returns (uint256) {
        return rewardToken.balanceOf(address(this));
    }
}
