import { useEffect, useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity,
    StyleSheet, KeyboardAvoidingView, Platform,
    Alert, Image
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../context/ThemeContext';
import ScreenWrapper from '../../components/ScreenWrapper';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { AxiosInstance } from '../../lib/Axios.instance';

export default function EditProfileScreen({ navigation }) {
    const { colors, isDark } = useTheme();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [image, setImage] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            const res = await AxiosInstance.get('/client-portal/profile');
            const c = res.data?.data || {};
            setName(c.clientName || '');
            setEmail(c.email || '');
            setPhone(c.phone || '');
            setImage(c.image || null);

        } catch (e) {
            console.log('Profile Error:', e);
        }
    };

    //  Pick from gallery
    const pickImage = async () => {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
            Alert.alert('Permission required');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.7,
        });

        if (!result.canceled) {
            setImage(result.assets[0].uri);
        }
    };

    //  Open camera
    const openCamera = async () => {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
            Alert.alert('Camera permission required');
            return;
        }

        const result = await ImagePicker.launchCameraAsync({
            quality: 0.7,
        });

        if (!result.canceled) {
            setImage(result.assets[0].uri);
        }
    };

    //  Choose option
    const chooseImage = () => {
        Alert.alert(
            'Upload Photo',
            'Choose an option',
            [
                { text: 'Camera', onPress: openCamera },
                { text: 'Gallery', onPress: pickImage },
                { text: 'Cancel', style: 'cancel' },
            ]
        );
    };

    //  Submit
    const handleSubmit = async () => {
        if (!name || !email || !phone) {
            Alert.alert('Error', 'Please fill all fields');
            return;
        }

        try {
            setLoading(true);

            // The client-portal profile PUT expects JSON with EDITABLE keys
            // (clientName, email, phone, image-as-URL). It does not accept a
            // multipart file upload, so we send JSON. A newly picked local image
            // (file:// uri) can't be hosted from here, so we only persist an
            // existing http image URL. (Client-side image upload needs a
            // dedicated endpoint — noted as a follow-up.)
            const payload = { clientName: name, email, phone };
            if (image && image.startsWith('http')) payload.image = image;

            await AxiosInstance.put('/client-portal/profile', payload);

            Alert.alert('Success', 'Profile updated successfully');
            navigation.goBack();

        } catch (e) {
            console.log('Update Error:', e);
            Alert.alert('Error', 'Update failed');
        } finally {
            setLoading(false);
        }
    };

    const s = styles(colors);

    return (
        <ScreenWrapper>
            <StatusBar style={isDark ? 'light' : 'dark'} />

            {/* Header */}
            <View style={s.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
                    <Ionicons name="chevron-back" size={18} color={colors.text} />
                </TouchableOpacity>
                <Text style={s.title}>Edit Profile</Text>
            </View>

            {/* Avatar */}
            <LinearGradient colors={[colors.gradStart, colors.gradEnd]} style={s.hero}>
                <TouchableOpacity onPress={chooseImage} style={{ alignItems: 'center' }}>

                    <View style={s.avatar}>
                        {image ? (
                            <Image source={{ uri: image }} style={s.avatarImg} />
                        ) : (
                            <Text style={s.avatarText}>{name[0] || 'A'}</Text>
                        )}
                    </View>

                    <View style={s.editBadge}>
                        <Ionicons name="camera" size={14} color={colors.primary} />
                    </View>

                </TouchableOpacity>
            </LinearGradient>

            {/* Form */}
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={{ padding: 20 }}
            >
                <View style={s.card}>

                    {/* Name */}
                    <Text style={s.label}>Full Name</Text>
                    <TextInput
                        style={s.input}
                        value={name}
                        onChangeText={setName}
                    />

                    {/* Email */}
                    <Text style={s.label}>Email</Text>
                    <TextInput
                        style={s.input}
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                    />

                    {/* Phone */}
                    <Text style={s.label}>Phone</Text>
                    <TextInput
                        style={s.input}
                        value={phone}
                        onChangeText={setPhone}
                        keyboardType="phone-pad"
                    />

                </View>

                {/* Button */}
                <TouchableOpacity onPress={handleSubmit} disabled={loading}>
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
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: 10
    },
    backBtn: {
        width: 36,
        height: 36,
        backgroundColor: c.card2,
        borderWidth: 1.5,
        borderColor: c.border,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10
    },
    title: {
        fontSize: 20,
        fontWeight: '800',
        color: c.text
    },
    hero: {
        alignItems: 'center',
        paddingVertical: 30,
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20
    },
    avatar: {
        width: 90,
        height: 90,
        borderRadius: 30,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden'
    },
    avatarImg: {
        width: '100%',
        height: '100%',
    },
    avatarText: {
        color: 'white',
        fontSize: 28,
        fontWeight: '800'
    },
    editBadge: {
        position: 'absolute',
        bottom: -6,
        right: -6,
        width: 28,
        height: 28,
        backgroundColor: 'white',
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center'
    },
    card: {
        backgroundColor: c.card,
        borderWidth: 1.5,
        borderColor: c.border,
        borderRadius: 16,
        padding: 16,
        marginBottom: 20
    },
    label: {
        fontSize: 12,
        color: c.text2,
        marginBottom: 6,
        marginTop: 10
    },
    input: {
        backgroundColor: c.bg2,
        borderWidth: 1.5,
        borderColor: c.border,
        borderRadius: 12,
        padding: 14,
        color: c.text
    },
    btn: {
        padding: 16,
        borderRadius: 12,
        alignItems: 'center'
    },
    btnText: {
        color: '#fff',
        fontWeight: '800',
        fontSize: 15
    }
});