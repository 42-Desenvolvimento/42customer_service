import { getIO } from "../../../libs/socket";
import { initWbot, removeWbot } from "../../../libs/wbot";
import Whatsapp from "../../../models/Whatsapp";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import wbotMonitor from "../../../services/WbotServices/wbotMonitor";
import { wbotMessageListener } from "../../../services/WbotServices/wbotMessageListener";

jest.mock("../../../libs/socket", () => ({
  getIO: jest.fn()
}));

jest.mock("../../../libs/wbot", () => ({
  initWbot: jest.fn(),
  removeWbot: jest.fn()
}));

jest.mock("../../../models/Whatsapp", () => ({
  __esModule: true,
  default: {
    findByPk: jest.fn()
  }
}));

jest.mock("../../../services/WbotServices/wbotMonitor", () => ({
  __esModule: true,
  default: jest.fn()
}));

jest.mock("../../../services/WbotServices/wbotMessageListener", () => ({
  wbotMessageListener: jest.fn()
}));

const mockedGetIO = getIO as jest.Mock;
const mockedInitWbot = initWbot as jest.Mock;
const mockedRemoveWbot = removeWbot as jest.Mock;
const mockedWhatsapp = Whatsapp as unknown as { findByPk: jest.Mock };
const mockedWbotMonitor = wbotMonitor as jest.Mock;
const mockedWbotMessageListener = wbotMessageListener as jest.Mock;

describe("StartWhatsAppSessionVerify", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should remove stale session before recovering sendSeen failures", async () => {
    const emit = jest.fn();
    const whatsapp = {
      id: 12,
      tenantId: 34,
      update: jest.fn().mockResolvedValue(undefined)
    };
    const wbot = { id: whatsapp.id };

    mockedGetIO.mockReturnValue({ emit });
    mockedWhatsapp.findByPk.mockResolvedValue(whatsapp);
    mockedRemoveWbot.mockResolvedValue(undefined);
    mockedInitWbot.mockResolvedValue(wbot);

    await StartWhatsAppSessionVerify(
      whatsapp.id,
      new TypeError("Cannot read property 'sendSeen' of undefined")
    );

    expect(mockedWhatsapp.findByPk).toHaveBeenCalledWith(whatsapp.id);
    expect(whatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
    expect(emit).toHaveBeenCalledWith(`${whatsapp.tenantId}:whatsappSession`, {
      action: "update",
      session: whatsapp
    });
    expect(mockedRemoveWbot).toHaveBeenCalledWith(whatsapp.id);
    expect(mockedInitWbot).toHaveBeenCalledWith(whatsapp);
    expect(
      mockedRemoveWbot.mock.invocationCallOrder[0]
    ).toBeLessThan(mockedInitWbot.mock.invocationCallOrder[0]);
    expect(mockedWbotMessageListener).toHaveBeenCalledWith(wbot);
    expect(mockedWbotMonitor).toHaveBeenCalledWith(wbot, whatsapp);
  });

  it("should ignore unrelated errors", async () => {
    await StartWhatsAppSessionVerify(12, new Error("rate limited"));

    expect(mockedWhatsapp.findByPk).not.toHaveBeenCalled();
    expect(mockedRemoveWbot).not.toHaveBeenCalled();
    expect(mockedInitWbot).not.toHaveBeenCalled();
  });
});
