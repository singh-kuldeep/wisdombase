import { createContext, useCallback, useContext, useMemo, useRef, useState, type PropsWithChildren } from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "../app/theme-context";

type AlertOptions = {
  title: string;
  message: string;
  buttonText?: string;
};

type ConfirmOptions = {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
};

type AlertRequest = {
  kind: "alert";
  title: string;
  message: string;
  buttonText: string;
  resolve: () => void;
};

type ConfirmRequest = {
  kind: "confirm";
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  destructive: boolean;
  resolve: (value: boolean) => void;
};

type DialogRequest = AlertRequest | ConfirmRequest;

type CustomAlertContextValue = {
  showAlert: (options: AlertOptions) => Promise<void>;
  showConfirm: (options: ConfirmOptions) => Promise<boolean>;
};

const CustomAlertContext = createContext<CustomAlertContextValue | undefined>(undefined);

export function CustomAlertProvider({ children }: PropsWithChildren) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const queueRef = useRef<DialogRequest[]>([]);
  const [current, setCurrent] = useState<DialogRequest | null>(null);

  const processQueue = useCallback(() => {
    if (current || queueRef.current.length === 0) return;
    const next = queueRef.current.shift() ?? null;
    setCurrent(next);
  }, [current]);

  const enqueue = useCallback(
    (request: DialogRequest) => {
      queueRef.current.push(request);
      setCurrent((prev) => {
        if (prev) return prev;
        return queueRef.current.shift() ?? null;
      });
    },
    [],
  );

  const closeCurrent = useCallback(() => {
    setCurrent(null);
    requestAnimationFrame(processQueue);
  }, [processQueue]);

  const showAlert = useCallback(
    (options: AlertOptions) =>
      new Promise<void>((resolve) => {
        enqueue({
          kind: "alert",
          title: options.title,
          message: options.message,
          buttonText: options.buttonText ?? "OK",
          resolve,
        });
      }),
    [enqueue],
  );

  const showConfirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        enqueue({
          kind: "confirm",
          title: options.title,
          message: options.message,
          confirmText: options.confirmText ?? "Confirm",
          cancelText: options.cancelText ?? "Cancel",
          destructive: !!options.destructive,
          resolve,
        });
      }),
    [enqueue],
  );

  const value = useMemo(
    () => ({ showAlert, showConfirm }),
    [showAlert, showConfirm],
  );

  return (
    <CustomAlertContext.Provider value={value}>
      {children}
      <Modal
        transparent
        visible={!!current}
        animationType="fade"
        onRequestClose={() => {
          if (!current) return;
          if (current.kind === "confirm") {
            current.resolve(false);
          } else {
            current.resolve();
          }
          closeCurrent();
        }}
      >
        <View style={styles.overlay}>
          <View style={styles.card}>
            <Text style={styles.title}>{current?.title}</Text>
            <Text style={styles.message}>{current?.message}</Text>

            {current?.kind === "confirm" ? (
              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton]}
                  onPress={() => {
                    current.resolve(false);
                    closeCurrent();
                  }}
                >
                  <Text style={styles.cancelText}>{current.cancelText}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.button,
                    current.destructive ? styles.destructiveButton : styles.primaryButton,
                  ]}
                  onPress={() => {
                    current.resolve(true);
                    closeCurrent();
                  }}
                >
                  <Text style={styles.primaryText}>{current.confirmText}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.button, styles.primaryButton, styles.singleButton]}
                onPress={() => {
                  current?.resolve();
                  closeCurrent();
                }}
              >
                <Text style={styles.primaryText}>{current?.buttonText ?? "OK"}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </CustomAlertContext.Provider>
  );
}

export function useCustomAlert() {
  const value = useContext(CustomAlertContext);
  if (!value) {
    throw new Error("useCustomAlert must be used within CustomAlertProvider");
  }
  return value;
}

function createStyles(colors: typeof import("../theme").colors) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: colors.bg === "#09111E" ? "rgba(3,8,16,0.66)" : "rgba(12,17,29,0.42)",
      justifyContent: "center",
      alignItems: "center",
      padding: 22,
    },
    card: {
      width: "100%",
      maxWidth: 420,
      backgroundColor: colors.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 20,
    },
    title: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 10,
    },
    message: {
      fontSize: 15,
      lineHeight: 22,
      color: colors.muted,
    },
    actionsRow: {
      flexDirection: "row",
      justifyContent: "flex-end",
      marginTop: 18,
      gap: 10,
    },
    button: {
      minWidth: 96,
      borderRadius: 12,
      paddingVertical: 11,
      paddingHorizontal: 16,
      alignItems: "center",
    },
    singleButton: {
      marginTop: 18,
      alignSelf: "flex-end",
    },
    cancelButton: {
      backgroundColor: colors.surfaceMuted,
    },
    primaryButton: {
      backgroundColor: colors.accent,
    },
    destructiveButton: {
      backgroundColor: colors.danger,
    },
    cancelText: {
      color: colors.text,
      fontWeight: "700",
      fontSize: 14,
    },
    primaryText: {
      color: "#fff",
      fontWeight: "700",
      fontSize: 14,
    },
  });
}
