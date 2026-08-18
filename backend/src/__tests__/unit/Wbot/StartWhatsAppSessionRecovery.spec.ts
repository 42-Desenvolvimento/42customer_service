const mockEmit = jest.fn();
const mockFindByPk = jest.fn();

jest.mock("../../../libs/socket", () => ({
  getIO: jest.fn(() => ({ emit: mockEmit }))
}));

jest.mock("../../../models/Whatsapp", () => ({
  __esModule: true,
  default: {
    findByPk: mockFindByPk
  }
}));

jest.mock("../../../libs/wbot", () => ({
  initWbot: jest.fn(),
  removeWbot: jest.fn()
}));

jest.mock("../../../services/WbotServices/wbotMessageListener", () => ({
  wbotMessageListener: jest.fn()
}));

jest.mock("../../../services/WbotServices/wbotMonitor", () => jest.fn());

import { initWbot, removeWbot } from "../../../libs/wbot";
import { StartWhatsAppSession } from "../../../services/WbotServices/StartWhatsAppSession";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import { wbotMessageListener } from "../../../services/WbotServices/wbotMessageListener";
import wbotMonitor from "../../../services/WbotServices/wbotMonitor";

const mockedInitWbot = initWbot as jest.Mock;
const mockedRemoveWbot = removeWbot as jest.Mock;
const mockedWbotMessageListener = wbotMessageListener as jest.Mock;
const mockedWbotMonitor = wbotMonitor as jest.Mock;

const makeWhatsapp = () =>
  ({
    id: 7,
    tenantId: 3,
    type: "whatsapp",
    update: jest.fn().mockResolvedValue(undefined)
  } as any);

describe("WhatsApp session recovery", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedInitWbot.mockResolvedValue({ id: 7 });
  });

  it("removes stale session before recovering from sendSeen failures", async () => {
    const whatsapp = makeWhatsapp();
    mockFindByPk.mockResolvedValue(whatsapp);

    await StartWhatsAppSessionVerify(
      whatsapp.id,
      "TypeError: Cannot read property 'sendSeen' of undefined"
    );

    expect(mockedRemoveWbot).toHaveBeenCalledWith(whatsapp.id);
    expect(mockedRemoveWbot.mock.invocationCallOrder[0]).toBeLessThan(
      mockedInitWbot.mock.invocationCallOrder[0]
    );
    expect(mockedInitWbot).toHaveBeenCalledWith(whatsapp);
    expect(mockedWbotMessageListener).toHaveBeenCalledWith({ id: 7 });
    expect(mockedWbotMonitor).toHaveBeenCalledWith({ id: 7 }, whatsapp);
  });

  it("removes stale session before starting a whatsapp session", async () => {
    const whatsapp = makeWhatsapp();

    await StartWhatsAppSession(whatsapp);

    expect(mockedRemoveWbot).toHaveBeenCalledWith(whatsapp.id);
    expect(mockedRemoveWbot.mock.invocationCallOrder[0]).toBeLessThan(
      mockedInitWbot.mock.invocationCallOrder[0]
    );
    expect(mockedInitWbot).toHaveBeenCalledWith(whatsapp);
  });
});
