import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

// Auth screens
import LoginScreen from '../screens/LoginScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';

// Client screens
import HomeScreen from '../screens/HomeScreen';
import ServicesScreen from '../screens/ServicesScreen';
import PaymentsScreen from '../screens/PaymentsScreen';
import SupportScreen from '../screens/SupportScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ServiceDetailScreen from '../screens/ServiceDetailScreen';
import RenewalsScreen from '../screens/RenewalsScreen';
import ProposalsScreen from '../screens/ProposalsScreen';
import AllTicketsScreen from '../screens/AllTicketsScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import EditProfileScreen from '../screens/profile/EditProfileScreen';
import ChangePasswordScreen from '../screens/profile/ChangePasswordScreen';
import NotificationsSettingsScreen from '../screens/profile/NotificationsSettingsScreen';

// Employee screens
import DashboardScreen from '../screens/employee/DashboardScreen';
import MeetingsScreen from '../screens/employee/MeetingsScreen';
import MeetingDetailScreen from '../screens/employee/MeetingDetailScreen';
import ClientsScreen from '../screens/employee/ClientsScreen';
import AddClientScreen from '../screens/employee/AddClientScreen';
import ClientDetailScreen from '../screens/employee/ClientDetailScreen';
import VisitsScreen from '../screens/employee/VisitsScreen';
import LeavesScreen from '../screens/employee/LeavesScreen';
import EmployeeProfileScreen from '../screens/employee/EmployeeProfileScreen';
import EmployeeEditProfileScreen from '../screens/employee/EmployeeEditProfileScreen';
import EmployeeChangePasswordScreen from '../screens/employee/EmployeeChangePasswordScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// ─── Client Bottom Tabs ───────────────────────────────────────────────────────
function ClientTabs() {
  const { colors } = useTheme();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          borderTopWidth: 1.5,
          height: 70,
          paddingBottom: 10,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.text3,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
        tabBarIcon: ({ focused, color }) => {
          const icons = {
            Home: focused ? 'home' : 'home-outline',
            Services: focused ? 'layers' : 'layers-outline',
            Payments: focused ? 'card' : 'card-outline',
            Support: focused ? 'help-circle' : 'help-circle-outline',
            Profile: focused ? 'person' : 'person-outline',
          };
          return <Ionicons name={icons[route.name]} size={22} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Services" component={ServicesScreen} />
      <Tab.Screen name="Payments" component={PaymentsScreen} />
      <Tab.Screen name="Support" component={SupportScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

// ─── Employee Bottom Tabs ─────────────────────────────────────────────────────
function EmployeeTabs() {
  const { colors } = useTheme();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          borderTopWidth: 1.5,
          height: 70,
          paddingBottom: 10,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.text3,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
        tabBarIcon: ({ focused, color }) => {
          const icons = {
            Dashboard: focused ? 'grid' : 'grid-outline',
            Meetings: focused ? 'calendar' : 'calendar-outline',
            Clients: focused ? 'people' : 'people-outline',

            Visits: focused ? 'map' : 'map-outline',
            EmpProfile: focused ? 'person' : 'person-outline',
          };
          return <Ionicons name={icons[route.name]} size={22} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Meetings" component={MeetingsScreen} />
      <Tab.Screen name="Clients" component={ClientsScreen} />
      <Tab.Screen name="Visits" component={VisitsScreen} />
      <Tab.Screen name="EmpProfile" component={EmployeeProfileScreen} options={{ tabBarLabel: 'Profile' }} />
    </Tab.Navigator>
  );
}

// ─── Root Navigator ───────────────────────────────────────────────────────────
export default function AppNavigator({ navRef }) {
  const { isLoggedIn, loading, role } = useAuth();
  if (loading) return null;

  return (
    <NavigationContainer ref={navRef}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isLoggedIn ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          </>
        ) : role === 'employee' ? (
          <>
            <Stack.Screen name="EmployeeMain" component={EmployeeTabs} />
            <Stack.Screen name="MeetingDetail" component={MeetingDetailScreen} />
            <Stack.Screen name="ClientDetail" component={ClientDetailScreen} />
            <Stack.Screen name="AddClient" component={AddClientScreen} options={{ tabBarLabel: 'Add Client' }} />
            <Stack.Screen name="Leaves" component={LeavesScreen} options={{ tabBarLabel: 'Leaves' }} />
            <Stack.Screen name="EmployeeEditProfile" component={EmployeeEditProfileScreen} />
            <Stack.Screen name="EmployeeChangePassword" component={EmployeeChangePasswordScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Main" component={ClientTabs} />
            <Stack.Screen name="ServiceDetail" component={ServiceDetailScreen} />
            <Stack.Screen name="Renewals" component={RenewalsScreen} />
            <Stack.Screen name="Proposals" component={ProposalsScreen} />
            <Stack.Screen name="AllTickets" component={AllTicketsScreen} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} />
            <Stack.Screen name="EditProfile" component={EditProfileScreen} />
            <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
            <Stack.Screen name="NotificationsSettings" component={NotificationsSettingsScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}