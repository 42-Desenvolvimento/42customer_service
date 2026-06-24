import { initWbot, removeWbot } from "../../../libs/wbot";
import { getIO } from "../../../libs/socket";
import Whatsapp from "../../../models/Whatsapp";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import { wbotMessageListener } from "../../../services/WbotServices/wbotMessageListener";
import wbotMonitor from "../../../services/WbotServices/wbotMonitor";

jest.mock("../../../libs/wbot", () => ({
  initWbot: jest.fn(),
  removeWbot: jest.fn()
}));

jest.mock("../../../libs/socket", () => ({
  getIO: jest.fn()
}));

jest.mock("../../../models/Whatsapp", () => ({
  __esModule: true,
  default: {
    findByPk: jest.fn()
  }
}));

jest.mock("../../../services/WbotServices/wbotMessageListener", () => ({
  wbotMessageListener: jest.fn()
}));

jest.mock("../../../services/WbotServices/wbotMonitor", () => ({
  __esModule: true,
  default: jest.fn()
}));

jest.mock("../../../utils/logger", () => ({
  logger: {
    error: jest.fn()
  }
}));

const mockedInitWbot = initWbot as jest.Mock;
const mockedRemoveWbot = removeWbot as jest.Mock;
const mockedGetIO = getIO as jest.Mock;
const mockedWhatsapp = Whatsapp as unknown as {
  findByPk: jest.Mock;
};
const mockedWbotMessageListener = wbotMessageListener as jest.Mock;
const mockedWbotMonitor = wbotMonitor as jest.Mock;

describe("StartWhatsAppSessionVerify", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetIO.mockReturnValue({
      emit: jest.fn()
    });
  });

  it("recovers sendSeen disconnect errors and replaces the stale session before initializing a new one", async () => {
    const calls: string[] = [];
    const whatsapp = {
      id: 12,
      tenantId: 3,
      update: jest.fn().mockResolvedValue(undefined)
    };
    const wbot = { id: 12 };

    mockedWhatsapp.findByPk.mockResolvedValue(whatsapp);
    mockedRemoveWbot.mockImplementation(() => calls.push("remove"));
    mockedInitWbot.mockImplementation(async () => {
      calls.push("init");
      return wbot;
    });

    await StartWhatsAppSessionVerify(
      whatsapp.id,
      "TypeError: Cannot read property 'sendSeen' of undefined"
    );

    expect(mockedWhatsapp.findByPk).toHaveBeenCalledWith(whatsapp.id);
    expect(whatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
    expect(calls).toEqual(["remove", "init"]);
    expect(mockedRemoveWbot).toHaveBeenCalledWith(whatsapp.id);
    expect(mockedInitWbot).toHaveBeenCalledWith(whatsapp);
    expect(mockedWbotMessageListener).toHaveBeenCalledWith(wbot);
    expect(mockedWbotMonitor).toHaveBeenCalledWith(wbot, whatsapp);
  });

  it("ignores non recoverable errors", async () => {
    await StartWhatsAppSessionVerify(12, "invalid media file");

    expect(mockedWhatsapp.findByPk).not.toHaveBeenCalled();
    expect(mockedRemoveWbot).not.toHaveBeenCalled();
    expect(mockedInitWbot).not.toHaveBeenCalled();
  });
});
