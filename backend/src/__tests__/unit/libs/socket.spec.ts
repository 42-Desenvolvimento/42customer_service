import { Server } from "http";
import { initIO } from "../../../libs/socket";
import decodeTokenSocket from "../../../libs/decodeTokenSocket";
import User from "../../../models/User";

jest.mock("socket.io", () => {
  const socketIoInstance = {
    adapter: jest.fn(),
    use: jest.fn(),
    on: jest.fn()
  };

  return {
    Server: jest.fn(() => socketIoInstance),
    __socketIoInstance: socketIoInstance
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

const socketIoMock = jest.requireMock("socket.io") as {
  __socketIoInstance: {
    adapter: jest.Mock;
    use: jest.Mock;
    on: jest.Mock;
  };
};
const decodeTokenSocketMock = decodeTokenSocket as jest.Mock;
const userFindByPkMock = User.findByPk as jest.Mock;

const getAuthMiddleware = () => {
  initIO({} as Server);

  return socketIoMock.__socketIoInstance.use.mock.calls[0][0];
};

describe("socket initIO authentication middleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("hydrates socket auth with token data and user lookup when the token is valid", async () => {
    const user = { id: 123, name: "Socket User" };
    const authMiddleware = getAuthMiddleware();
    const socket = {
      handshake: {
        auth: {
          token: "valid-token",
          client: "web"
        }
      },
      emit: jest.fn()
    };
    const next = jest.fn();

    decodeTokenSocketMock.mockReturnValue({
      isValid: true,
      data: {
        id: 123,
        tenantId: 456,
        profile: "admin"
      }
    });
    userFindByPkMock.mockResolvedValue(user);

    await authMiddleware(socket, next);

    expect(userFindByPkMock).toHaveBeenCalledWith(123, {
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
    expect(socket.handshake.auth).toEqual({
      token: "valid-token",
      client: "web",
      id: "123",
      tenantId: "456",
      profile: "admin",
      user
    });
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  it("rejects the socket when token validation fails", async () => {
    const authMiddleware = getAuthMiddleware();
    const socket = {
      id: "socket-1",
      handshake: {
        auth: {
          token: "invalid-token"
        }
      },
      emit: jest.fn()
    };
    const next = jest.fn();

    decodeTokenSocketMock.mockReturnValue({
      isValid: false,
      data: {
        id: "",
        tenantId: "",
        profile: ""
      }
    });

    await authMiddleware(socket, next);

    expect(userFindByPkMock).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(next.mock.calls[0][0].message).toBe("authentication error");
  });
});
