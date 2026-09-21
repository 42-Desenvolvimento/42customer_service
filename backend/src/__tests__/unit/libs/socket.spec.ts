import { Server as SocketServer } from "socket.io";
import decodeTokenSocket from "../../../libs/decodeTokenSocket";
import User from "../../../models/User";
import { initIO } from "../../../libs/socket";

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

describe("socket initIO authentication", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("does not fall through to an authentication error after a valid token", async () => {
    const user = { id: 15, tenantId: 22, name: "Agent" };
    const socket = {
      handshake: {
        auth: {
          token: "valid-token",
          keep: "existing-auth-data"
        }
      },
      emit: jest.fn()
    };
    const next = jest.fn();

    (decodeTokenSocket as unknown as jest.Mock).mockReturnValue({
      isValid: true,
      data: {
        id: 15,
        tenantId: 22,
        profile: "admin"
      }
    });
    (User.findByPk as unknown as jest.Mock).mockResolvedValue(user);

    const io = initIO({} as any);
    const authMiddleware = (io.use as jest.Mock).mock.calls[0][0];

    await authMiddleware(socket, next);

    expect(decodeTokenSocket).toHaveBeenCalledWith("valid-token");
    expect(User.findByPk).toHaveBeenCalledWith(15, {
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
      keep: "existing-auth-data",
      id: "15",
      tenantId: "22",
      profile: "admin",
      user
    });
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0]).toHaveLength(0);
    expect(SocketServer).toHaveBeenCalledTimes(1);
  });
});
