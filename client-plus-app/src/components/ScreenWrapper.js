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
}) {
    const { colors } = useTheme();

    if (isScrollable) {
        return (
            <SafeAreaView edges={edges} style={[{ flex: 1, backgroundColor: colors.bg }, style]}>
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={[
                        // { paddingBottom: 10 },
                        contentStyle,
                    ]}
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