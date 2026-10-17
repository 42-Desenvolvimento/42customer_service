import { Server as SocketIOServer } from "socket.io";
import decodeTokenSocket from "../../libs/decodeTokenSocket";
import { initIO } from "../../libs/socket";
import User from "../../models/User";

jest.mock("socket.io", () => ({
  Server: jest.fn().mockImplementation(() => ({
    adapter: jest.fn(),
    on: jest.fn(),
    use: jest.fn()
  }))
}));

jest.mock("socket.io-redis", () => jest.fn(() => "redis-adapter"));
jest.mock("../../libs/decodeTokenSocket", () => jest.fn());
jest.mock("../../models/User", () => ({
  findByPk: jest.fn()
}));
jest.mock("../../libs/socketChat/Chat", () => ({
  register: jest.fn()
}));
jest.mock("../../utils/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn()
  }
}));

const socketIOServerMock = SocketIOServer as unknown as jest.Mock;
const decodeTokenSocketMock = decodeTokenSocket as unknown as jest.Mock;
const userFindByPkMock = User.findByPk as jest.Mock;

describe("Socket IO authentication", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const getRegisteredMiddleware = () => {
    initIO({} as any);
    const ioInstance = socketIOServerMock.mock.results[0].value;
    return ioInstance.use.mock.calls[0][0];
  };

  it("calls next only once and attaches user data when the token is valid", async () => {
    const user = { id: 10, name: "Socket User" };
    decodeTokenSocketMock.mockReturnValue({
      isValid: true,
      data: {
        id: 10,
        tenantId: 20,
        email: "socket@test.com"
      }
    });
    userFindByPkMock.mockResolvedValue(user);

    const middleware = getRegisteredMiddleware();
    const next = jest.fn();
    const socket = {
      handshake: {
        auth: {
          token: "valid-token",
          client: "web"
        }
      }
    };

    await middleware(socket, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
    expect(socket.handshake.auth).toMatchObject({
      client: "web",
      email: "socket@test.com",
      id: "10",
      tenantId: "20",
      user
    });
    expect(userFindByPkMock).toHaveBeenCalledWith(10, {
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

  it("rejects an invalid token without loading the user", async () => {
    decodeTokenSocketMock.mockReturnValue({
      isValid: false,
      data: {}
    });

    const middleware = getRegisteredMiddleware();
    const next = jest.fn();
    const socket = {
      handshake: {
        auth: {
          token: "invalid-token"
        }
      }
    };

    await middleware(socket, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(new Error("authentication error"));
    expect(userFindByPkMock).not.toHaveBeenCalled();
  });
});
