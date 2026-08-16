jest.mock("socket.io", () => ({
  Server: jest.fn().mockImplementation(() => ({
    adapter: jest.fn(),
    use: jest.fn(),
    on: jest.fn()
  }))
}));

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

import { Server as SocketIOServer } from "socket.io";
import decodeTokenSocket from "../../../libs/decodeTokenSocket";
import User from "../../../models/User";
import { initIO } from "../../../libs/socket";

const mockedSocketIOServer = SocketIOServer as unknown as jest.Mock;
const mockedDecodeTokenSocket = decodeTokenSocket as jest.Mock;
const mockedUserFindByPk = User.findByPk as jest.Mock;

const buildSocket = () =>
  ({
    id: "socket-1",
    handshake: {
      auth: {
        token: "token-123",
        existing: "value"
      }
    },
    emit: jest.fn(),
    join: jest.fn(),
    on: jest.fn()
  } as any);

const getRegisteredMiddleware = () => {
  initIO({} as any);
  const serverInstance = mockedSocketIOServer.mock.results[0].value;
  return serverInstance.use.mock.calls[0][0];
};

describe("socket initIO authentication middleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("authenticates a valid token and calls next only once", async () => {
    const user = { id: 7, tenantId: 3, name: "User" };
    mockedDecodeTokenSocket.mockReturnValue({
      isValid: true,
      data: {
        id: 7,
        tenantId: 3,
        profile: "admin"
      }
    });
    mockedUserFindByPk.mockResolvedValue(user);
    const socket = buildSocket();
    const next = jest.fn();

    const middleware = getRegisteredMiddleware();
    await middleware(socket, next);

    expect(mockedUserFindByPk).toHaveBeenCalledWith(7, {
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
      token: "token-123",
      existing: "value",
      id: "7",
      tenantId: "3",
      profile: "admin",
      user
    });
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  it("rejects invalid tokens without loading a user", async () => {
    mockedDecodeTokenSocket.mockReturnValue({
      isValid: false,
      data: {}
    });
    const socket = buildSocket();
    const next = jest.fn();

    const middleware = getRegisteredMiddleware();
    await middleware(socket, next);

    expect(mockedUserFindByPk).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(next.mock.calls[0][0].message).toBe("authentication error");
  });
});
