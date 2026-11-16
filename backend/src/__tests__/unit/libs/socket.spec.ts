jest.mock("socket.io", () => {
  const socketServer = {
    adapter: jest.fn(),
    use: jest.fn(),
    on: jest.fn()
  };
  const Server = jest.fn(() => socketServer);

  return { Server, __socketServer: socketServer };
});

jest.mock("socket.io-redis", () => ({
  __esModule: true,
  default: jest.fn(() => "redis-adapter")
}));

jest.mock("../../../libs/decodeTokenSocket", () => ({
  __esModule: true,
  default: jest.fn()
}));

jest.mock("../../../models/User", () => ({
  __esModule: true,
  default: {
    findByPk: jest.fn()
  }
}));

jest.mock("../../../libs/socketChat/Chat", () => ({
  __esModule: true,
  default: {
    register: jest.fn()
  }
}));

jest.mock("../../../utils/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn()
  }
}));

import { initIO } from "../../../libs/socket";
import decodeTokenSocket from "../../../libs/decodeTokenSocket";
import User from "../../../models/User";

describe("socket", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should authenticate a valid socket token without also rejecting it", async () => {
    const socketIOMock = jest.requireMock("socket.io");
    const socketServer = socketIOMock.__socketServer;
    const user = { id: 1, tenantId: 2, name: "User" };
    const next = jest.fn();
    const socket = {
      id: "socket-1",
      handshake: {
        auth: {
          token: "valid-token",
          keep: "me"
        }
      },
      emit: jest.fn()
    };

    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: true,
      data: {
        id: 1,
        tenantId: 2,
        profile: "admin"
      }
    });
    (User.findByPk as jest.Mock).mockResolvedValue(user);

    initIO({} as any);

    const middleware = socketServer.use.mock.calls[0][0];
    await middleware(socket, next);

    expect(User.findByPk).toHaveBeenCalledWith(1, {
      attributes: [
        "id",
        "tenantId",
        "name",
        "email",
        "profile",
        "status",
        "lastLogin",
        "lastOnline"
      ]
    });
    expect(socket.handshake.auth).toMatchObject({
      token: "valid-token",
      keep: "me",
      id: "1",
      tenantId: "2",
      profile: "admin",
      user
    });
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
    expect(socket.emit).not.toHaveBeenCalled();
  });
});
