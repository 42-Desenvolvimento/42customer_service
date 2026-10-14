import Whatsapp from "../../../models/Whatsapp";
import { initWbot, removeWbot } from "../../../libs/wbot";
import { getIO } from "../../../libs/socket";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import { wbotMessageListener } from "../../../services/WbotServices/wbotMessageListener";
import wbotMonitor from "../../../services/WbotServices/wbotMonitor";

jest.mock("../../../models/Whatsapp", () => ({
  __esModule: true,
  default: {
    findByPk: jest.fn()
  }
}));

jest.mock("../../../libs/wbot", () => ({
  initWbot: jest.fn(),
  removeWbot: jest.fn()
}));

jest.mock("../../../libs/socket", () => ({
  getIO: jest.fn()
}));

jest.mock("../../../services/WbotServices/wbotMessageListener", () => ({
  wbotMessageListener: jest.fn()
}));

jest.mock("../../../services/WbotServices/wbotMonitor", () => ({
  __esModule: true,
  default: jest.fn()
}));

const mockedWhatsapp = Whatsapp as jest.Mocked<typeof Whatsapp>;
const mockedInitWbot = initWbot as jest.MockedFunction<typeof initWbot>;
const mockedRemoveWbot = removeWbot as jest.MockedFunction<typeof removeWbot>;
const mockedGetIO = getIO as jest.MockedFunction<typeof getIO>;
const mockedWbotMessageListener = wbotMessageListener as jest.MockedFunction<
  typeof wbotMessageListener
>;
const mockedWbotMonitor = wbotMonitor as jest.MockedFunction<typeof wbotMonitor>;

describe("StartWhatsAppSessionVerify", () => {
  const io = {
    emit: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetIO.mockReturnValue(io as never);
  });

  it("should remove a stale session before initializing a replacement client", async () => {
    const callOrder: string[] = [];
    const whatsapp = {
      id: 12,
      tenantId: 34,
      update: jest.fn().mockResolvedValue(undefined)
    };
    const wbot = { id: whatsapp.id };

    mockedWhatsapp.findByPk.mockResolvedValue(whatsapp as never);
    mockedRemoveWbot.mockImplementation(() => {
      callOrder.push("remove");
    });
    mockedInitWbot.mockImplementation(async () => {
      callOrder.push("init");
      return wbot as never;
    });

    await StartWhatsAppSessionVerify(
      whatsapp.id,
      new Error("Protocol error: Session closed.")
    );

    expect(whatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
    expect(mockedRemoveWbot).toHaveBeenCalledWith(whatsapp.id);
    expect(mockedInitWbot).toHaveBeenCalledWith(whatsapp);
    expect(callOrder).toEqual(["remove", "init"]);
    expect(mockedWbotMessageListener).toHaveBeenCalledWith(wbot);
    expect(mockedWbotMonitor).toHaveBeenCalledWith(wbot, whatsapp);
  });

  it("should recover when sendSeen fails because the session object is disconnected", async () => {
    const whatsapp = {
      id: 56,
      tenantId: 78,
      update: jest.fn().mockResolvedValue(undefined)
    };
    const wbot = { id: whatsapp.id };

    mockedWhatsapp.findByPk.mockResolvedValue(whatsapp as never);
    mockedInitWbot.mockResolvedValue(wbot as never);

    await StartWhatsAppSessionVerify(
      whatsapp.id,
      "TypeError: Cannot read property 'sendSeen' of undefined"
    );

    expect(mockedRemoveWbot).toHaveBeenCalledWith(whatsapp.id);
    expect(mockedInitWbot).toHaveBeenCalledWith(whatsapp);
  });

  it("should ignore errors that do not indicate a broken session", async () => {
    await StartWhatsAppSessionVerify(90, new Error("invalid media type"));

    expect(mockedWhatsapp.findByPk).not.toHaveBeenCalled();
    expect(mockedRemoveWbot).not.toHaveBeenCalled();
    expect(mockedInitWbot).not.toHaveBeenCalled();
  });
});
