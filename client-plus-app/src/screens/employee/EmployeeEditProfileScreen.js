import { useEffect, useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity,
    StyleSheet, KeyboardAvoidingView, Platform,
    Alert, Image, ActivityIndicator
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../context/ThemeContext';
import ScreenWrapper from '../../components/ScreenWrapper';
import { Ionicons } from '@expo/vector-icons';
import { EmployeeAPI } from '../../services/employee.api';

export default function EmployeeEditProfileScreen({ navigation }) {
    const { colors, isDark } = useTheme();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [image, setImage] = useState(null);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [fetching, setFetching] = useState(true);

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            const res = await EmployeeAPI.getProfile();
            const p = res.data?.data || res.data || {};
            setName(p.name || '');
            setEmail(p.email || '');
            setPhone(p.phone || '');
            setImage(p.image || null);
        } catch (e) {
            console.log('Profile Error:', e);
        } finally {
            setFetching(false);
        }
    };

    // Upload a locally picked image to Cloudinary via /upload, then swap
    // the local preview uri for the returned https URL.
    const uploadPickedImage = async (asset) => {
        try {
            setUploading(true);
            const base64 = asset.base64;
            if (!base64) throw new Error('No image data');
            const mime = asset.mimeType || 'image/jpeg';
            const dataUrl = `data:${mime};base64,${base64}`;
            const res = await EmployeeAPI.uploadImage(dataUrl, 'avatars');
            const url = res.data?.data?.url;
            if (url) setImage(url);
            else throw new Error('Upload did not return a URL');
        } catch (e) {
            console.log('Image upload error:', e);
            Alert.alert('Error', 'Could not upload photo. Please try again.');
        } finally {
            setUploading(false);
        }
    };

    const pickImage = async () => {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
            Alert.alert('Permission required');
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.7,
            base64: true,
        });
        if (!result.canceled) {
            await uploadPickedImage(result.assets[0]);
        }
    };

    const openCamera = async () => {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
            Alert.alert('Camera permission required');
            return;
        }
        const result = await ImagePicker.launchCameraAsync({
            quality: 0.7,
            base64: true,
        });
        if (!result.canceled) {
            await uploadPickedImage(result.assets[0]);
        }
    };

    const chooseImage = () => {
        if (uploading) return;
        Alert.alert('Upload Photo', 'Choose an option', [
            { text: 'Camera', onPress: openCamera },
            { text: 'Gallery', onPress: pickImage },
            { text: 'Cancel', style: 'cancel' },
        ]);
    };

    const handleSubmit = async () => {
        if (!name || !phone) {
            Alert.alert('Error', 'Please fill all fields');
            return;
        }

        try {
            setLoading(true);
            // Employee PATCH /mobile/profile only accepts name, phone, avatar
            // (email is not editable by design — it's the login identifier).
            const payload = { name, phone };
            if (image) payload.avatar = image;

            await EmployeeAPI.updateProfile(payload);

            Alert.alert('Success', 'Profile updated successfully');
            navigation.goBack();
        } catch (e) {
            console.log('Update Error:', e);
            Alert.alert('Error', e?.message || 'Update failed');
        } finally {
            setLoading(false);
        }
    };

    const s = styles(colors);

    return (
        <ScreenWrapper>
            <StatusBar style={isDark ? 'light' : 'dark'} />

            <View style={s.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
                    <Ionicons name="chevron-back" size={18} color={colors.text} />
                </TouchableOpacity>
                <Text style={s.title}>Edit Profile</Text>
            </View>

            <LinearGradient colors={[colors.gradStart, colors.gradEnd]} style={s.hero}>
                <TouchableOpacity onPress={chooseImage} style={{ alignItems: 'center' }} disabled={uploading}>
                    <View style={s.avatar}>
                        {uploading ? (
                            <ActivityIndicator color="#fff" />
                        ) : image ? (
                            <Image source={{ uri: image }} style={s.avatarImg} />
                        ) : (
                            <Text style={s.avatarText}>{(name[0] || 'E').toUpperCase()}</Text>
                        )}
                    </View>
                    <View style={s.editBadge}>
                        <Ionicons name="camera" size={14} color={colors.primary} />
                    </View>
                </TouchableOpacity>
            </LinearGradient>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={{ padding: 20 }}
            >
                <View style={s.card}>
                    <Text style={s.label}>Full Name</Text>
                    <TextInput style={s.input} value={name} onChangeText={setName} editable={!fetching} />

                    <Text style={s.label}>Email</Text>
                    <TextInput
                        style={[s.input, s.inputDisabled]}
                        value={email}
                        editable={false}
                    />
                    <Text style={s.hint}>Email can't be changed here — contact admin</Text>

                    <Text style={s.label}>Phone</Text>
                    <TextInput
                        style={s.input}
                        value={phone}
                        onChangeText={setPhone}
                        keyboardType="phone-pad"
                        editable={!fetching}
                    />
                </View>

                <TouchableOpacity onPress={handleSubmit} disabled={loading || fetching}>
                    <LinearGradient colors={[colors.gradStart, colors.gradEnd]} style={s.btn}>
                        <Text style={s.btnText}>
                            {loading ? 'Saving...' : 'Save Changes →'}
                        </Text>
                    </LinearGradient>
                </TouchableOpacity>
            </KeyboardAvoidingView>
        </ScreenWrapper>
    );
}

const styles = (c) => StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 10 },
    backBtn: { width: 36, height: 36, backgroundColor: c.card2, borderWidth: 1.5, borderColor: c.border, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
    title: { fontSize: 20, fontWeight: '800', color: c.text },
    hero: { alignItems: 'center', paddingVertical: 30, borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },
    avatar: { width: 90, height: 90, borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    avatarImg: { width: '100%', height: '100%' },
    avatarText: { color: 'white', fontSize: 28, fontWeight: '800' },
    editBadge: { position: 'absolute', bottom: -6, right: -6, width: 28, height: 28, backgroundColor: 'white', borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    card: { backgroundColor: c.card, borderWidth: 1.5, borderColor: c.border, borderRadius: 16, padding: 16, marginBottom: 20 },
    label: { fontSize: 12, color: c.text2, marginBottom: 6, marginTop: 10 },
    hint: { fontSize: 11, color: c.text3, marginTop: 4 },
    input: { backgroundColor: c.bg2, borderWidth: 1.5, borderColor: c.border, borderRadius: 12, padding: 14, color: c.text },
    inputDisabled: { opacity: 0.6 },
    btn: { padding: 16, borderRadius: 12, alignItems: 'center' },
    btnText: { color: '#fff', fontWeight: '800', fontSize: 15 }
});
