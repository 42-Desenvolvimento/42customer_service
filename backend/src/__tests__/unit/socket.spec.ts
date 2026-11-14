jest.mock("socket.io", () => {
  const serverInstance = {
    adapter: jest.fn(),
    use: jest.fn(),
    on: jest.fn()
  };

  return {
    Server: jest.fn(() => serverInstance)
  };
});

jest.mock("socket.io-redis", () => jest.fn(() => "redis-adapter"));
jest.mock("../../libs/decodeTokenSocket", () => jest.fn());
jest.mock("../../models/User", () => ({
  __esModule: true,
  default: {
    findByPk: jest.fn()
  }
}));
jest.mock("../../libs/socketChat/Chat", () => ({
  __esModule: true,
  default: {
    register: jest.fn()
  }
}));
jest.mock("../../utils/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn()
  }
}));

import { Server as SocketIOServer } from "socket.io";
import decodeTokenSocket from "../../libs/decodeTokenSocket";
import User from "../../models/User";
import { initIO } from "../../libs/socket";

describe("socket init authentication", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("accepts a valid token without also returning an authentication error", async () => {
    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: true,
      data: {
        id: 123,
        profile: "admin",
        tenantId: 456
      }
    });
    (User.findByPk as jest.Mock).mockResolvedValue({
      id: 123,
      name: "Socket User"
    });

    initIO({} as any);

    const ioInstance = (SocketIOServer as unknown as jest.Mock).mock.results[0]
      .value;
    const middleware = ioInstance.use.mock.calls[0][0];
    const socket = {
      id: "socket-1",
      emit: jest.fn(),
      handshake: {
        auth: {
          token: "valid-token"
        }
      }
    };
    const next = jest.fn();

    await middleware(socket, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
    expect(next).not.toHaveBeenCalledWith(expect.any(Error));
    expect(socket.handshake.auth).toMatchObject({
      id: "123",
      profile: "admin",
      tenantId: "456",
      user: {
        id: 123,
        name: "Socket User"
      }
    });
  });
});
