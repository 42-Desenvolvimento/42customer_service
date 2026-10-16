import { initWbot, removeWbot } from "../../../libs/wbot";
import Whatsapp from "../../../models/Whatsapp";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import { wbotMessageListener } from "../../../services/WbotServices/wbotMessageListener";
import wbotMonitor from "../../../services/WbotServices/wbotMonitor";

const mockEmit = jest.fn();

jest.mock("../../../libs/wbot", () => ({
  initWbot: jest.fn(),
  removeWbot: jest.fn()
}));

jest.mock("../../../libs/socket", () => ({
  getIO: jest.fn(() => ({ emit: mockEmit }))
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

jest.mock("../../../services/WbotServices/wbotMonitor", () => jest.fn());

jest.mock("../../../utils/logger", () => ({
  logger: {
    error: jest.fn()
  }
}));

describe("StartWhatsAppSessionVerify", () => {
  const mockedFindByPk = Whatsapp.findByPk as jest.Mock;
  const mockedInitWbot = initWbot as jest.MockedFunction<typeof initWbot>;
  const mockedRemoveWbot = removeWbot as jest.MockedFunction<typeof removeWbot>;
  const mockedWbotMessageListener = wbotMessageListener as jest.MockedFunction<
    typeof wbotMessageListener
  >;
  const mockedWbotMonitor = wbotMonitor as jest.MockedFunction<
    typeof wbotMonitor
  >;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("recovers sendSeen failures by removing the stale session before init", async () => {
    const callOrder: string[] = [];
    const wbot = { id: 10 } as any;
    const whatsapp = {
      id: 10,
      tenantId: 20,
      update: jest.fn().mockResolvedValue(undefined)
    } as any;

    mockedFindByPk.mockResolvedValue(whatsapp);
    mockedRemoveWbot.mockImplementation(async () => {
      callOrder.push("remove");
    });
    mockedInitWbot.mockImplementation(async () => {
      callOrder.push("init");
      return wbot;
    });

    await StartWhatsAppSessionVerify(
      whatsapp.id,
      new TypeError("Cannot read property 'sendSeen' of undefined")
    );

    expect(mockedFindByPk).toHaveBeenCalledWith(whatsapp.id);
    expect(whatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
    expect(mockEmit).toHaveBeenCalledWith(`${whatsapp.tenantId}:whatsappSession`, {
      action: "update",
      session: whatsapp
    });
    expect(callOrder).toEqual(["remove", "init"]);
    expect(mockedRemoveWbot).toHaveBeenCalledWith(whatsapp.id);
    expect(mockedInitWbot).toHaveBeenCalledWith(whatsapp);
    expect(mockedWbotMessageListener).toHaveBeenCalledWith(wbot);
    expect(mockedWbotMonitor).toHaveBeenCalledWith(wbot, whatsapp);
  });

  it("ignores errors that do not indicate a broken whatsapp session", async () => {
    await StartWhatsAppSessionVerify(10, new Error("temporary rate limit"));

    expect(mockedFindByPk).not.toHaveBeenCalled();
    expect(mockedRemoveWbot).not.toHaveBeenCalled();
    expect(mockedInitWbot).not.toHaveBeenCalled();
  });
});
