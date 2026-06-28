import { getHours } from "date-fns";
import { MissingValueError, pupa } from "../../../utils/pupa";

jest.mock("date-fns", () => ({
  getHours: jest.fn()
}));

const mockedGetHours = getHours as jest.MockedFunction<typeof getHours>;

describe("pupa", () => {
  beforeEach(() => {
    mockedGetHours.mockReset();
    mockedGetHours.mockReturnValue(9);
  });

  it("should calculate greeting at render time", () => {
    mockedGetHours.mockReturnValue(9);
    expect(pupa("{greeting} {contact.name}", { contact: { name: "Ana" } })).toBe(
      "Bom dia! Ana"
    );

    mockedGetHours.mockReturnValue(14);
    expect(pupa("{greeting} {contact.name}", { contact: { name: "Bia" } })).toBe(
      "Boa Tarde! Bia"
    );

    mockedGetHours.mockReturnValue(20);
    expect(pupa("{greeting} {contact.name}", { contact: { name: "Caio" } })).toBe(
      "Boa Noite! Caio"
    );

    mockedGetHours.mockReturnValue(2);
    expect(pupa("{greeting} {contact.name}", { contact: { name: "Duda" } })).toBe(
      "Ol\u00e1! Duda"
    );
  });

  it("should escape double-brace values and interpolate nested keys", () => {
    const result = pupa("Cliente {contact.name}: {{message}}", {
      contact: { name: "Ana" },
      message: "<b>ok & pronto</b>"
    });

    expect(result).toBe("Cliente Ana: &lt;b&gt;ok &amp; pronto&lt;/b&gt;");
  });

  it("should throw when a required placeholder is missing", () => {
    expect(() =>
      pupa("Cliente: {contact.name}", {}, { ignoreMissing: false })
    ).toThrow(MissingValueError);
    expect(() =>
      pupa("Cliente: {contact.name}", {}, { ignoreMissing: false })
    ).toThrow("Missing a value for the placeholder: contact.name");
  });
});
