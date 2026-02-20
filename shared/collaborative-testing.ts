export interface TeamWorkspace {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  members: WorkspaceMember[];
  testSuites: string[];
  sharedConfigs: Record<string, any>;
  createdAt: number;
  updatedAt: number;
}

export interface WorkspaceMember {
  userId: string;
  displayName: string;
  role: MemberRole;
  joinedAt: number;
  lastActive: number;
  permissions: Permission[];
}

export enum MemberRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  EDITOR = 'editor',
  VIEWER = 'viewer',
}

export enum Permission {
  CREATE_TESTS = 'create_tests',
  EDIT_TESTS = 'edit_tests',
  DELETE_TESTS = 'delete_tests',
  RUN_TESTS = 'run_tests',
  VIEW_RESULTS = 'view_results',
  MANAGE_MEMBERS = 'manage_members',
  EDIT_CONFIG = 'edit_config',
  APPROVE_REVIEWS = 'approve_reviews',
}

export interface ReviewRequest {
  id: string;
  testId: string;
  testName: string;
  requesterId: string;
  reviewers: string[];
  status: ReviewStatus;
  comments: ReviewComment[];
  changes: TestChange[];
  createdAt: number;
  updatedAt: number;
  resolvedAt?: number;
}

export enum ReviewStatus {
  PENDING = 'pending',
  IN_REVIEW = 'in_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CHANGES_REQUESTED = 'changes_requested',
}

export interface ReviewComment {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  type: 'comment' | 'approval' | 'rejection' | 'suggestion';
  lineRef?: string;
  createdAt: number;
}

export interface TestChange {
  type: 'added' | 'modified' | 'deleted';
  field: string;
  oldValue?: any;
  newValue?: any;
  description: string;
}

export interface SharedTestAsset {
  id: string;
  name: string;
  type: 'test_suite' | 'test_data' | 'config' | 'report' | 'template';
  ownerId: string;
  workspaceId: string;
  data: any;
  version: number;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export interface Notification {
  id: string;
  recipientId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: any;
  read: boolean;
  createdAt: number;
}

export enum NotificationType {
  REVIEW_REQUESTED = 'review_requested',
  REVIEW_COMPLETED = 'review_completed',
  TEST_FAILED = 'test_failed',
  MEMBER_JOINED = 'member_joined',
  ASSET_SHARED = 'asset_shared',
  COMMENT_ADDED = 'comment_added',
  APPROVAL_NEEDED = 'approval_needed',
}

const STORAGE_KEY = 'hyperagent_collaboration';

const ROLE_PERMISSIONS: Record<MemberRole, Permission[]> = {
  [MemberRole.OWNER]: Object.values(Permission),
  [MemberRole.ADMIN]: [
    Permission.CREATE_TESTS, Permission.EDIT_TESTS, Permission.DELETE_TESTS,
    Permission.RUN_TESTS, Permission.VIEW_RESULTS, Permission.MANAGE_MEMBERS,
    Permission.EDIT_CONFIG, Permission.APPROVE_REVIEWS,
  ],
  [MemberRole.EDITOR]: [
    Permission.CREATE_TESTS, Permission.EDIT_TESTS,
    Permission.RUN_TESTS, Permission.VIEW_RESULTS,
  ],
  [MemberRole.VIEWER]: [Permission.VIEW_RESULTS],
};

export class CollaborativeTestingManager {
  private workspaces: Map<string, TeamWorkspace> = new Map();
  private reviews: Map<string, ReviewRequest> = new Map();
  private assets: Map<string, SharedTestAsset> = new Map();
  private notifications: Notification[] = [];
  private maxNotifications = 500;

  createWorkspace(name: string, ownerId: string, description: string = ''): TeamWorkspace {
    const workspace: TeamWorkspace = {
      id: `ws_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      name,
      description,
      ownerId,
      members: [{
        userId: ownerId,
        displayName: 'Owner',
        role: MemberRole.OWNER,
        joinedAt: Date.now(),
        lastActive: Date.now(),
        permissions: ROLE_PERMISSIONS[MemberRole.OWNER],
      }],
      testSuites: [],
      sharedConfigs: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.workspaces.set(workspace.id, workspace);
    return workspace;
  }

  getWorkspace(id: string): TeamWorkspace | undefined {
    return this.workspaces.get(id);
  }

  getAllWorkspaces(): TeamWorkspace[] {
    return Array.from(this.workspaces.values());
  }

  getUserWorkspaces(userId: string): TeamWorkspace[] {
    return this.getAllWorkspaces().filter(ws =>
      ws.members.some(m => m.userId === userId)
    );
  }

  addMember(workspaceId: string, userId: string, displayName: string, role: MemberRole): boolean {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) return false;

    if (workspace.members.some(m => m.userId === userId)) return false;

    workspace.members.push({
      userId,
      displayName,
      role,
      joinedAt: Date.now(),
      lastActive: Date.now(),
      permissions: ROLE_PERMISSIONS[role],
    });
    workspace.updatedAt = Date.now();

    this.addNotification({
      recipientId: userId,
      type: NotificationType.MEMBER_JOINED,
      title: 'Added to workspace',
      message: `You were added to "${workspace.name}" as ${role}`,
    });

    return true;
  }

  removeMember(workspaceId: string, userId: string): boolean {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) return false;

    const memberIndex = workspace.members.findIndex(m => m.userId === userId);
    if (memberIndex < 0) return false;

    if (workspace.members[memberIndex].role === MemberRole.OWNER) return false;

    workspace.members.splice(memberIndex, 1);
    workspace.updatedAt = Date.now();
    return true;
  }

  hasPermission(workspaceId: string, userId: string, permission: Permission): boolean {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) return false;

    const member = workspace.members.find(m => m.userId === userId);
    if (!member) return false;

    return member.permissions.includes(permission);
  }

  createReview(testId: string, testName: string, requesterId: string, reviewers: string[], changes: TestChange[]): ReviewRequest {
    const review: ReviewRequest = {
      id: `review_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      testId,
      testName,
      requesterId,
      reviewers,
      status: ReviewStatus.PENDING,
      comments: [],
      changes,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.reviews.set(review.id, review);

    for (const reviewerId of reviewers) {
      this.addNotification({
        recipientId: reviewerId,
        type: NotificationType.REVIEW_REQUESTED,
        title: 'Review requested',
        message: `Review requested for test "${testName}"`,
        data: { reviewId: review.id },
      });
    }

    return review;
  }

  addComment(reviewId: string, authorId: string, authorName: string, content: string, type: ReviewComment['type'] = 'comment'): ReviewComment | null {
    const review = this.reviews.get(reviewId);
    if (!review) return null;

    const comment: ReviewComment = {
      id: `comment_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      authorId,
      authorName,
      content,
      type,
      createdAt: Date.now(),
    };

    review.comments.push(comment);
    review.updatedAt = Date.now();

    if (type === 'approval') {
      review.status = ReviewStatus.APPROVED;
      review.resolvedAt = Date.now();
      this.addNotification({
        recipientId: review.requesterId,
        type: NotificationType.REVIEW_COMPLETED,
        title: 'Review approved',
        message: `Your test "${review.testName}" was approved`,
      });
    } else if (type === 'rejection') {
      review.status = ReviewStatus.REJECTED;
      review.resolvedAt = Date.now();
      this.addNotification({
        recipientId: review.requesterId,
        type: NotificationType.REVIEW_COMPLETED,
        title: 'Review rejected',
        message: `Your test "${review.testName}" was rejected: ${content}`,
      });
    } else if (type === 'suggestion') {
      review.status = ReviewStatus.CHANGES_REQUESTED;
    }

    return comment;
  }

  getReview(reviewId: string): ReviewRequest | undefined {
    return this.reviews.get(reviewId);
  }

  getReviewsForUser(userId: string): ReviewRequest[] {
    return Array.from(this.reviews.values()).filter(
      r => r.requesterId === userId || r.reviewers.includes(userId)
    );
  }

  getPendingReviews(userId: string): ReviewRequest[] {
    return Array.from(this.reviews.values()).filter(
      r => r.reviewers.includes(userId) && r.status === ReviewStatus.PENDING
    );
  }

  shareAsset(asset: Omit<SharedTestAsset, 'id' | 'version' | 'createdAt' | 'updatedAt'>): SharedTestAsset {
    const fullAsset: SharedTestAsset = {
      ...asset,
      id: `asset_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.assets.set(fullAsset.id, fullAsset);
    return fullAsset;
  }

  getAsset(assetId: string): SharedTestAsset | undefined {
    return this.assets.get(assetId);
  }

  getWorkspaceAssets(workspaceId: string): SharedTestAsset[] {
    return Array.from(this.assets.values()).filter(a => a.workspaceId === workspaceId);
  }

  updateAsset(assetId: string, data: any): boolean {
    const asset = this.assets.get(assetId);
    if (!asset) return false;

    asset.data = data;
    asset.version++;
    asset.updatedAt = Date.now();
    return true;
  }

  getNotifications(userId: string, unreadOnly: boolean = false): Notification[] {
    let filtered = this.notifications.filter(n => n.recipientId === userId);
    if (unreadOnly) {
      filtered = filtered.filter(n => !n.read);
    }
    return filtered;
  }

  markNotificationRead(notificationId: string): boolean {
    const notification = this.notifications.find(n => n.id === notificationId);
    if (!notification) return false;
    notification.read = true;
    return true;
  }

  markAllRead(userId: string): number {
    let count = 0;
    for (const n of this.notifications) {
      if (n.recipientId === userId && !n.read) {
        n.read = true;
        count++;
      }
    }
    return count;
  }

  async persist(): Promise<void> {
    try {
      if (!chrome?.storage?.local) return;
      await chrome.storage.local.set({
        [STORAGE_KEY]: {
          workspaces: Array.from(this.workspaces.entries()),
          reviews: Array.from(this.reviews.entries()),
          assets: Array.from(this.assets.entries()),
          notifications: this.notifications.slice(-200),
        },
      });
    } catch (err) {
      console.error('[Collaboration] Persist failed:', err);
    }
  }

  async restore(): Promise<void> {
    try {
      if (!chrome?.storage?.local) return;
      const data = await chrome.storage.local.get(STORAGE_KEY);
      const stored = data[STORAGE_KEY];
      if (!stored) return;

      if (Array.isArray(stored.workspaces)) {
        for (const [id, ws] of stored.workspaces) this.workspaces.set(id, ws);
      }
      if (Array.isArray(stored.reviews)) {
        for (const [id, r] of stored.reviews) this.reviews.set(id, r);
      }
      if (Array.isArray(stored.assets)) {
        for (const [id, a] of stored.assets) this.assets.set(id, a);
      }
      if (Array.isArray(stored.notifications)) {
        this.notifications = stored.notifications;
      }
    } catch (err) {
      console.error('[Collaboration] Restore failed:', err);
    }
  }

  private addNotification(params: Omit<Notification, 'id' | 'read' | 'createdAt'>): void {
    this.notifications.push({
      ...params,
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      read: false,
      createdAt: Date.now(),
    });
    if (this.notifications.length > this.maxNotifications) {
      this.notifications.shift();
    }
  }
}

export const collaborativeTestingManager = new CollaborativeTestingManager();
