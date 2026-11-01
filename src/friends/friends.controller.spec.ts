import { FriendsController } from './friends.controller';

describe('FriendsController', () => {
  let controller: FriendsController;
  let service: {
    findPendingRequests: jest.Mock;
    rejectRequest: jest.Mock;
  };

  beforeEach(() => {
    service = {
      findPendingRequests: jest.fn(),
      rejectRequest: jest.fn(),
    };

    controller = new FriendsController(service as any);
  });

  it('should list pending friend requests for the user', async () => {
    const pendingRequests = [{ id: 'req-1', senderId: 'user-2' }];
    service.findPendingRequests.mockResolvedValue(pendingRequests);

    const result = await controller.listPendingRequests('user-1');

    expect(service.findPendingRequests).toHaveBeenCalledWith('user-1');
    expect(result).toEqual(pendingRequests);
  });

  it('should reject a pending friend request', async () => {
    const rejectedRequest = { id: 'req-1', status: 'rejected' };
    service.rejectRequest.mockResolvedValue(rejectedRequest);

    const result = await controller.rejectFriendRequest('req-1', 'user-1');

    expect(service.rejectRequest).toHaveBeenCalledWith('req-1', 'user-1');
    expect(result).toEqual(rejectedRequest);
  });
});
