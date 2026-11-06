import { Server as SocketIOServer } from "socket.io";
import decodeTokenSocket from "../../../libs/decodeTokenSocket";
import { initIO } from "../../../libs/socket";
import User from "../../../models/User";

jest.mock("socket.io", () => {
  const mockServerInstance = {
    adapter: jest.fn(),
    use: jest.fn(),
    on: jest.fn()
  };

  return {
    Server: jest.fn(() => mockServerInstance),
    __mockServerInstance: mockServerInstance
  };
});

jest.mock("socket.io-redis", () => jest.fn(() => "redis-adapter"));

jest.mock("../../../libs/decodeTokenSocket", () => jest.fn());

jest.mock("../../../models/User", () => ({
  findByPk: jest.fn()
}));

jest.mock("../../../libs/socketChat/Chat", () => ({
  register: jest.fn()
}));

jest.mock("../../../utils/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn()
  }
}));

describe("socket initIO authentication middleware", () => {
  const decodeTokenSocketMock = decodeTokenSocket as jest.Mock;
  const userFindByPkMock = User.findByPk as jest.Mock;
  const socketIoMock = jest.requireMock("socket.io") as {
    __mockServerInstance: {
      adapter: jest.Mock;
      use: jest.Mock;
      on: jest.Mock;
    };
  };

  beforeEach(() => {
    (SocketIOServer as unknown as jest.Mock).mockClear();
    socketIoMock.__mockServerInstance.adapter.mockClear();
    socketIoMock.__mockServerInstance.use.mockClear();
    socketIoMock.__mockServerInstance.on.mockClear();
    decodeTokenSocketMock.mockReset();
    userFindByPkMock.mockReset();
  });

  it("enriches valid socket auth and calls next only once without an error", async () => {
    const user = { id: 7, name: "Jane" };
    decodeTokenSocketMock.mockReturnValue({
      isValid: true,
      data: {
        id: 7,
        profile: "admin",
        tenantId: 99
      }
    });
    userFindByPkMock.mockResolvedValue(user);

    initIO({} as any);
    const middleware = socketIoMock.__mockServerInstance.use.mock.calls[0][0];
    const socket = {
      handshake: {
        auth: {
          token: "valid-token",
          existing: "value"
        }
      }
    };
    const next = jest.fn();

    await middleware(socket, next);

    expect(socket.handshake.auth).toEqual({
      token: "valid-token",
      existing: "value",
      id: "7",
      profile: "admin",
      tenantId: "99",
      user
    });
    expect(userFindByPkMock).toHaveBeenCalledWith(7, {
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
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  it("rejects invalid socket tokens without loading the user", async () => {
    decodeTokenSocketMock.mockReturnValue({
      isValid: false,
      data: {
        id: "",
        profile: "",
        tenantId: 0
      }
    });

    initIO({} as any);
    const middleware = socketIoMock.__mockServerInstance.use.mock.calls[0][0];
    const next = jest.fn();

    await middleware(
      {
        handshake: {
          auth: {
            token: "invalid-token"
          }
        }
      },
      next
    );

    expect(userFindByPkMock).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toEqual(new Error("authentication error"));
  });
});
