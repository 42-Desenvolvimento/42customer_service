jest.mock("socket.io", () => {
  const io = {
    adapter: jest.fn(),
    use: jest.fn(),
    on: jest.fn()
  };

  return {
    Server: jest.fn(() => io)
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

import { Server as SocketIOServer } from "socket.io";
import decodeTokenSocket from "../../../libs/decodeTokenSocket";
import { initIO } from "../../../libs/socket";
import User from "../../../models/User";

describe("socket", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("allows a valid token without also returning an authentication error", async () => {
    const decodedToken = {
      isValid: true,
      data: {
        id: 123,
        profile: "admin",
        tenantId: 456
      }
    };
    const user = { id: 123, name: "Valid User" };

    (decodeTokenSocket as jest.Mock).mockReturnValue(decodedToken);
    (User.findByPk as jest.Mock).mockResolvedValue(user);

    initIO({} as any);

    const io = (SocketIOServer as unknown as jest.Mock).mock.results[0].value;
    const middleware = io.use.mock.calls[0][0];
    const socket = {
      id: "socket-1",
      handshake: {
        auth: {
          token: "valid-token",
          existing: "value"
        }
      },
      emit: jest.fn()
    };
    const next = jest.fn();

    await middleware(socket, next);

    expect(socket.handshake.auth).toMatchObject({
      token: "valid-token",
      existing: "value",
      id: "123",
      profile: "admin",
      tenantId: "456",
      user
    });
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });
});
