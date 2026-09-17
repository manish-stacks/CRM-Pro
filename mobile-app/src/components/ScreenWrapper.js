import React from 'react';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';

export default function ScreenWrapper({
    children,
    contentStyle,
    style,
    edges = ['top'],
    isScrollable = true,
    refreshControl,
}) {
    const { colors } = useTheme();

    if (isScrollable) {
        return (
            <SafeAreaView edges={edges} style={[{ flex: 1, backgroundColor: colors.bg }, style]}>
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={[
                        // Without this, buttons/fields at the end of a form sit flush
                        // against the screen edge (or the bottom tab bar on some
                        // devices) and look "hidden" / get clipped when scrolled all
                        // the way down.
                        { paddingBottom: 28 },
                        contentStyle,
                    ]}
                    keyboardShouldPersistTaps="handled"
                    refreshControl={refreshControl}
                >
                    {children}
                </ScrollView>
            </SafeAreaView>
        );
    }

    // Non-scrollable case
    return (
        <SafeAreaView edges={edges} style={[{ flex: 1, backgroundColor: colors.bg }, style]}>
            {children}
        </SafeAreaView>
    );
}