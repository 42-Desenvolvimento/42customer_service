const mockSocketIoServer = jest.fn();
const mockSocketRedis = jest.fn(() => "redis-adapter");

jest.mock("socket.io", () => ({
  Server: mockSocketIoServer
}));

jest.mock("socket.io-redis", () => mockSocketRedis);

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

import decodeTokenSocket from "../../../libs/decodeTokenSocket";
import User from "../../../models/User";
import { initIO } from "../../../libs/socket";

const decodeTokenSocketMock = decodeTokenSocket as jest.Mock;
const userFindByPkMock = User.findByPk as jest.Mock;

const buildIo = () => ({
  adapter: jest.fn(),
  use: jest.fn(),
  on: jest.fn()
});

describe("socket initIO authentication middleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("accepts a valid token without also returning an authentication error", async () => {
    const io = buildIo();
    const authenticatedUser = { id: 123, tenantId: 456, name: "Agent" };
    const socket = {
      id: "socket-1",
      handshake: {
        auth: {
          token: "valid-token",
          clientVersion: "web"
        }
      },
      emit: jest.fn()
    };
    const next = jest.fn();

    mockSocketIoServer.mockImplementation(() => io);
    decodeTokenSocketMock.mockReturnValue({
      isValid: true,
      data: {
        id: 123,
        tenantId: 456
      }
    });
    userFindByPkMock.mockResolvedValue(authenticatedUser);

    initIO({} as any);
    const middleware = io.use.mock.calls[0][0];

    await middleware(socket, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
    expect(socket.handshake.auth).toMatchObject({
      token: "valid-token",
      clientVersion: "web",
      id: "123",
      tenantId: "456",
      user: authenticatedUser
    });
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
  });

  it("rejects an invalid token", async () => {
    const io = buildIo();
    const socket = {
      id: "socket-2",
      handshake: {
        auth: {
          token: "invalid-token"
        }
      },
      emit: jest.fn()
    };
    const next = jest.fn();

    mockSocketIoServer.mockImplementation(() => io);
    decodeTokenSocketMock.mockReturnValue({
      isValid: false,
      data: {}
    });

    initIO({} as any);
    const middleware = io.use.mock.calls[0][0];

    await middleware(socket, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(next.mock.calls[0][0].message).toBe("authentication error");
    expect(userFindByPkMock).not.toHaveBeenCalled();
  });
});
